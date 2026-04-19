import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { kosiAnalyze, kosiDetect, type LiveDetection } from "../lib/kosi";

// Runtime toggles — change in .env and restart Metro to revert.
// `EXPO_PUBLIC_LIVE_QUALITY`: 0.4 = original tiny JPEGs, 0.7 = sharper (default).
const LIVE_QUALITY = (() => {
  const raw = process.env.EXPO_PUBLIC_LIVE_QUALITY;
  const n = raw ? parseFloat(raw) : 0.7;
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.7;
})();
// `EXPO_PUBLIC_LIVE_TRACKING`: "0" disables the smooth-and-coast tracker,
// "1" (default) keeps boxes stable across detect ticks.
const TRACKING_ENABLED = process.env.EXPO_PUBLIC_LIVE_TRACKING !== "0";
const COAST_MS = 1500;
const MATCH_IOU = 0.30;
const SMOOTH_NEW = 0.7; // weight on the new box position when smoothing

/**
 * "Live AR" view: full-screen camera preview with red detection boxes
 * overlaid. Every ~1.5s we snapshot a frame, send it to Kosi's /detect
 * (YOLO-only, no GPT), and refresh the boxes. Not true 30-fps AR; more like
 * a "point it, see labels" experience with ~1s lag.
 */
export type LiveOverlayResult = {
  instructions: string;
  imageUrl: string;
};

type TrackedBox = LiveDetection & { id: string; firstSeen: number; lastSeen: number };

function iou(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const interX = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const interY = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = interX * interY;
  if (inter <= 0) return 0;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** Merge fresh detections into the current tracker state. Returns the new
 *  list of display boxes: matched ones smoothed, unmatched ones kept for
 *  `COAST_MS` before they drop. */
function mergeTracked(
  existing: TrackedBox[],
  fresh: LiveDetection[],
  now: number
): TrackedBox[] {
  const matched = new Set<string>();
  const nextBoxes: TrackedBox[] = [];
  for (const det of fresh) {
    let best: TrackedBox | null = null;
    let bestIoU = MATCH_IOU;
    for (const box of existing) {
      if (box.label !== det.label) continue;
      if (matched.has(box.id)) continue;
      const score = iou(det, box);
      if (score > bestIoU) {
        bestIoU = score;
        best = box;
      }
    }
    if (best) {
      matched.add(best.id);
      nextBoxes.push({
        ...det,
        id: best.id,
        x: det.x * SMOOTH_NEW + best.x * (1 - SMOOTH_NEW),
        y: det.y * SMOOTH_NEW + best.y * (1 - SMOOTH_NEW),
        width: det.width * SMOOTH_NEW + best.width * (1 - SMOOTH_NEW),
        height: det.height * SMOOTH_NEW + best.height * (1 - SMOOTH_NEW),
        firstSeen: best.firstSeen,
        lastSeen: now,
      });
    } else {
      nextBoxes.push({
        ...det,
        id: `${det.label}-${now}-${Math.random().toString(36).slice(2, 6)}`,
        firstSeen: now,
        lastSeen: now,
      });
    }
  }
  // Coast: keep recently-unmatched boxes visible briefly to stop flicker.
  for (const box of existing) {
    if (matched.has(box.id)) continue;
    if (now - box.lastSeen < COAST_MS) nextBoxes.push(box);
  }
  return nextBoxes;
}

export function LiveOverlayScreen({
  issue,
  assistantContext,
  onClose,
  onDone,
}: {
  issue: string;
  /** Assistant's most recent reply to the user's intent. Appended to the
   *  issue when we finally call /analyze so the LLM sees the photo as a
   *  response to that clarifying turn. Not shown in the UI. */
  assistantContext?: string | null;
  onClose: () => void;
  /** Called when the user taps ✕ AND we have a best frame worth saving.
   *  The parent should add this as a chat message. */
  onDone: (payload: LiveOverlayResult) => void;
}) {
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  /** Display boxes — tracked+smoothed when TRACKING_ENABLED, raw otherwise. */
  const [tracked, setTracked] = useState<TrackedBox[]>([]);
  const [frameAspect, setFrameAspect] = useState<number>(4 / 3);
  const [viewSize, setViewSize] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
  const cancelRef = useRef(false);
  const inFlightRef = useRef(false);
  const trackedRef = useRef<TrackedBox[]>([]);
  /** Most recent frame that actually had detections — we keep its URI +
   *  detections so that when the user exits we can save the "best" view. */
  const bestFrameRef = useRef<{ uri: string; detections: LiveDetection[] } | null>(null);

  useEffect(() => {
    if (cameraPerm && !cameraPerm.granted) requestCameraPerm();
  }, [cameraPerm]);

  // Poll loop: take a picture → send → update boxes, ~every 1.5 s.
  useEffect(() => {
    if (!cameraPerm?.granted) return;
    cancelRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelRef.current) return;
      if (inFlightRef.current || !cameraRef.current) {
        timer = setTimeout(tick, 200);
        return;
      }
      inFlightRef.current = true;
      setBusy(true);
      try {
        const pic = await cameraRef.current.takePictureAsync({
          quality: LIVE_QUALITY,
          skipProcessing: true,
          shutterSound: false,
        });
        if (!pic?.uri) throw new Error("no frame captured");
        if (pic.width && pic.height) setFrameAspect(pic.width / pic.height);
        const res = await kosiDetect(pic.uri, issue);
        if (!cancelRef.current) {
          setError(null);
          if (TRACKING_ENABLED) {
            const merged = mergeTracked(trackedRef.current, res.detections, Date.now());
            trackedRef.current = merged;
            setTracked(merged);
          } else {
            // No tracking — just show raw detections as throwaway boxes.
            const now = Date.now();
            const raw: TrackedBox[] = res.detections.map((d, i) => ({
              ...d,
              id: `raw-${now}-${i}`,
              firstSeen: now,
              lastSeen: now,
            }));
            trackedRef.current = raw;
            setTracked(raw);
          }
          if (res.detections.length > 0) {
            // Keep this frame as a candidate for "save to chat on exit".
            bestFrameRef.current = { uri: pic.uri, detections: res.detections };
          }
        }
      } catch (e) {
        if (!cancelRef.current) setError(e instanceof Error ? e.message : "detect failed");
      } finally {
        inFlightRef.current = false;
        setBusy(false);
        if (!cancelRef.current) timer = setTimeout(tick, 1500);
      }
    };

    timer = setTimeout(tick, 500);
    return () => {
      cancelRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [cameraPerm?.granted, issue]);

  const onCameraLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewSize({ w: width, h: height });
  };

  /** Handle the ✕ tap: if we have a best frame, analyse it then hand the
   *  result to the parent. Otherwise exit silently. */
  const handleExit = async () => {
    const best = bestFrameRef.current;
    if (!best) {
      onClose();
      return;
    }
    cancelRef.current = true;
    setAnalyzing(true);
    try {
      const trimmed = issue.trim();
      const ctx = assistantContext?.trim();
      const baseIssue =
        trimmed || "Describe what you see in one short sentence. Do not invent problems.";
      const analyzeIssue = ctx && trimmed
        ? `${baseIssue}\n\n(Context: FlashFix asked "${ctx}" — this photo is the user's response.)`
        : baseIssue;
      const res = await kosiAnalyze(best.uri, analyzeIssue);
      onDone({
        instructions: res.instructions,
        imageUrl: res.imageUrl,
      });
    } catch (e) {
      setAnalyzing(false);
      setError(e instanceof Error ? e.message : "analysis failed");
      // Give user a chance to see the error then exit after a tap.
      setTimeout(() => onClose(), 2500);
    }
  };

  // Permission gate
  if (cameraPerm && !cameraPerm.granted) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.big}>Camera permission needed</Text>
        <Text style={styles.muted}>
          Allow camera access in phone Settings → Apps → FlashFix.
        </Text>
        <Pressable onPress={onClose} style={styles.closeCta}>
          <Text style={styles.closeCtaText}>Close</Text>
        </Pressable>
      </View>
    );
  }
  if (!cameraPerm) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="white" />
      </View>
    );
  }

  // Compute the overlay rectangle for each detection. The preview is set to
  // `aspectRatio: frameAspect` and centred, so its on-screen size equals
  // `viewSize` directly — box coords are already normalised 0-1 in the
  // captured frame, which matches the preview 1:1.
  const renderBoxes = () => {
    if (!viewSize) return null;
    return tracked.map((d) => {
      const left = d.x * viewSize.w;
      const top = d.y * viewSize.h;
      const w = d.width * viewSize.w;
      const h = d.height * viewSize.h;
      return (
        <View
          key={d.id}
          pointerEvents="none"
          style={[styles.box, { left, top, width: w, height: h }]}
        >
          <View style={styles.labelWrap}>
            <Text style={styles.labelText} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        </View>
      );
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.cameraFrame} onLayout={onCameraLayout}>
        <CameraView
          ref={(r) => {
            cameraRef.current = r;
          }}
          style={[StyleSheet.absoluteFill, { aspectRatio: frameAspect }]}
          facing="back"
          mode="picture"
        />
        {renderBoxes()}
      </View>

      <View style={styles.topBar}>
        <Pressable
          onPress={handleExit}
          hitSlop={8}
          style={styles.exitBtn}
          disabled={analyzing}
        >
          <Text style={styles.exitText}>✕</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Live View</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {issue || "tap ✕ when done"}
          </Text>
        </View>
        <View style={styles.statusDot}>
          {busy ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <View style={[styles.dot, { backgroundColor: "#16a34a" }]} />
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.caption}>
        <Text style={styles.captionText}>{describeDetections(tracked)}</Text>
      </View>

      <View style={styles.bottomHint}>
        <Text style={styles.hintText}>
          Tap ✕ when done — I'll add what I saw to our chat.
        </Text>
      </View>

      {analyzing ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.busyText}>FlashFix's taking a good look…</Text>
          <Text style={styles.busyHint}>
            This takes about 15 seconds. You'll land back in our chat.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Turn raw YOLO labels into a friendly sentence for the live caption. */
function describeDetections(dets: LiveDetection[]): string {
  if (dets.length === 0) return "Looking around… point me at something.";
  // Dedupe and keep the first N labels by original order (which is already
  // by confidence descending because the server sorts them).
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const d of dets) {
    const l = d.label.toLowerCase();
    if (!seen.has(l)) {
      seen.add(l);
      labels.push(l);
    }
    if (labels.length >= 3) break;
  }
  if (labels.length === 1) return `I see a ${labels[0]}.`;
  if (labels.length === 2) return `I see a ${labels[0]} and a ${labels[1]}.`;
  return `I see a ${labels[0]}, a ${labels[1]}, and a ${labels[2]}.`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  big: { color: "white", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  muted: { color: "#94a3b8", textAlign: "center", marginBottom: 20 },
  closeCta: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#2563eb",
  },
  closeCtaText: { color: "white", fontWeight: "700" },

  cameraFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  topBar: {
    position: "absolute",
    top: 14,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 5,
  },
  exitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  exitText: { color: "white", fontSize: 18, fontWeight: "700" },
  titleWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  title: { color: "white", fontSize: 14, fontWeight: "700" },
  subtitle: { color: "#cbd5f5", fontSize: 12 },
  statusDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },

  errorBar: {
    position: "absolute",
    top: 64,
    left: 12,
    right: 12,
    backgroundColor: "rgba(220,38,38,0.9)",
    padding: 10,
    borderRadius: 10,
    zIndex: 6,
  },
  errorText: { color: "white", fontWeight: "600", fontSize: 13 },

  caption: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 4,
  },
  captionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: "rgba(15,23,42,0.75)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  bottomHint: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 4,
  },
  hintText: {
    color: "white",
    fontSize: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  busyText: { color: "white", fontSize: 17, fontWeight: "700" },
  busyHint: { color: "#cbd5f5", fontSize: 13, textAlign: "center", paddingHorizontal: 24 },

  box: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#dc2626",
    borderRadius: 6,
    zIndex: 3,
  },
  labelWrap: {
    position: "absolute",
    bottom: -22,
    left: 0,
    backgroundColor: "#dc2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelText: { color: "white", fontSize: 12, fontWeight: "700" },
});
