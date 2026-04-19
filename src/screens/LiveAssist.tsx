import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { kosiAnalyzeVideo, type KosiVideoResult } from "../lib/kosi";

const MAX_SECONDS = 10;

type Phase = "idle" | "recording" | "uploading" | "analyzing" | "result" | "error";

export function LiveAssistScreen({
  initialIssue,
  assistantContext,
  onDone,
  onCancel,
}: {
  initialIssue: string;
  /** Assistant's most recent reply to the user's intent (e.g. "what's the
   *  issue?"). Appended to the issue text sent to the server so the LLM knows
   *  the recording is a response to that clarifying turn. Not shown in the UI. */
  assistantContext?: string | null;
  /** Called when the user accepts the result. Parent gets the verdict text
   *  and the URL of the best annotated frame so it can add a chat message. */
  onDone: (payload: { text: string; annotatedUrl: string | null }) => void;
  onCancel: () => void;
}) {
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [phase, setPhase] = useState<Phase>("idle");
  const [issue, setIssue] = useState(initialIssue);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [result, setResult] = useState<KosiVideoResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ask for permissions on mount.
  useEffect(() => {
    if (cameraPerm && !cameraPerm.granted) requestCameraPerm();
    if (micPerm && !micPerm.granted) requestMicPerm();
  }, [cameraPerm, micPerm]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecord = async () => {
    if (!cameraRef.current) return;
    if (!issue.trim()) {
      setErrorMsg("Tell FlashFix what you want her to check first.");
      return;
    }
    setErrorMsg(null);
    setPhase("recording");
    setSecondsLeft(MAX_SECONDS);
    stopTimer();
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    try {
      const rec = await cameraRef.current.recordAsync({ maxDuration: MAX_SECONDS });
      stopTimer();
      if (!rec?.uri) {
        setPhase("idle");
        return;
      }
      setPhase("uploading");
      try {
        setPhase("analyzing");
        const ctx = assistantContext?.trim();
        const effectiveIssue = ctx
          ? `${issue.trim()}\n\n(Context: FlashFix asked "${ctx}" — this video is the user's response.)`
          : issue.trim();
        const res = await kosiAnalyzeVideo(rec.uri, effectiveIssue);
        setResult(res);
        setPhase("result");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "analysis failed");
        setPhase("error");
      }
    } catch (e) {
      stopTimer();
      setErrorMsg(e instanceof Error ? e.message : "recording failed");
      setPhase("error");
    }
  };

  const stopRecord = () => {
    stopTimer();
    cameraRef.current?.stopRecording();
  };

  const accept = () => {
    if (!result) return onCancel();
    const best = result.bestFrames[0];
    onDone({
      text: result.assistantOutput || "I checked your video.",
      annotatedUrl: best?.annotated_url ?? null,
    });
  };

  // Permission gate — we record muted so mic is not required.
  const hasCamera = cameraPerm?.granted;
  if (cameraPerm && !hasCamera) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Live Assist</Text>
          <Pressable onPress={onCancel} hitSlop={8} style={styles.exitBtn}>
            <Text style={styles.exitText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.bigText}>Camera permission needed</Text>
          <Text style={styles.muted}>
            Allow camera access in phone Settings → Apps → FlashFix.
          </Text>
        </View>
      </View>
    );
  }
  if (!cameraPerm) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  // Results view
  if (phase === "result" && result) {
    const best = result.bestFrames[0];
    return (
      <View style={styles.resultRoot}>
        <View style={styles.header}>
          <Text style={styles.title}>What I saw</Text>
          <Pressable onPress={onCancel} hitSlop={8} style={styles.exitBtn}>
            <Text style={styles.exitText}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {best?.annotated_url ? (
            <Image source={{ uri: best.annotated_url }} style={styles.resultImage} />
          ) : null}
          <Text style={styles.verdictLabel}>FlashFix says</Text>
          <Text style={styles.verdictText}>{result.assistantOutput}</Text>
          <View style={styles.summaryRow}>
            <SummaryChip label="connected" n={result.summary.connected} color="#16a34a" />
            <SummaryChip label="near" n={result.summary.near} color="#b45309" />
            <SummaryChip label="not connected" n={result.summary.not_connected} color="#dc2626" />
            <SummaryChip label="unclear" n={result.summary.inconclusive} color="#64748b" />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable onPress={onCancel} style={[styles.footerBtn, styles.footerBtnGhost]}>
            <Text style={styles.footerBtnGhostText}>Discard</Text>
          </Pressable>
          <Pressable onPress={accept} style={[styles.footerBtn, styles.footerBtnPrimary]}>
            <Text style={styles.footerBtnPrimaryText}>Keep in chat</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Camera + controls
  const busy = phase === "uploading" || phase === "analyzing";
  const recording = phase === "recording";

  return (
    <View style={styles.root}>
      <CameraView
        ref={(r) => {
          cameraRef.current = r;
        }}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
        mute={true}
        videoQuality="720p"
      />

      <View style={styles.topBar}>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕</Text>
        </Pressable>
        <Text style={styles.topTitle}>Live Assist</Text>
        {recording ? (
          <View style={styles.timer}>
            <View style={styles.recDot} />
            <Text style={styles.timerText}>{secondsLeft}s</Text>
          </View>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {!recording && !busy ? (
        <View style={styles.issueBar}>
          <Text style={styles.issueLabel}>I'll check:</Text>
          <TextInput
            value={issue}
            onChangeText={setIssue}
            placeholder="e.g. is my mouse plugged into the right port"
            placeholderTextColor="#cbd5f5"
            style={styles.issueInput}
            multiline
          />
        </View>
      ) : null}

      {busy ? (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.busyText}>
            {phase === "uploading" ? "Uploading your video…" : "FlashFix is looking carefully…"}
          </Text>
          <Text style={styles.busyHint}>This can take up to 20 seconds.</Text>
        </View>
      ) : null}

      {errorMsg ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <View style={styles.bottom}>
        {!busy ? (
          <Pressable
            onPress={recording ? stopRecord : startRecord}
            style={({ pressed }) => [
              styles.shutter,
              recording && styles.shutterRecording,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={recording ? styles.shutterStopInner : styles.shutterInner} />
          </Pressable>
        ) : null}
        <Text style={styles.hint}>
          {recording
            ? "Tap again to stop, or wait for auto-stop"
            : busy
            ? ""
            : "Point at the setup and tap to record up to 10s"}
        </Text>
      </View>
    </View>
  );
}

function SummaryChip({ label, n, color }: { label: string; n: number; color: string }) {
  if (n <= 0) return null;
  return (
    <View style={[styles.sumChip, { borderColor: color }]}>
      <Text style={[styles.sumN, { color }]}>{n}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  resultRoot: { flex: 1, backgroundColor: "#fffbf5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  bigText: { color: "white", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  muted: { color: "#94a3b8", textAlign: "center" },

  topBar: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 5,
  },
  topTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  exitText: { color: "white", fontSize: 18, fontWeight: "700" },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(220,38,38,0.9)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "white" },
  timerText: { color: "white", fontWeight: "700", fontSize: 13 },

  issueBar: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    padding: 12,
    zIndex: 4,
  },
  issueLabel: { color: "#cbd5f5", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  issueInput: { color: "white", fontSize: 15, minHeight: 24 },

  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  busyText: { color: "white", fontSize: 16, fontWeight: "700" },
  busyHint: { color: "#cbd5f5", fontSize: 13 },

  errorBar: {
    position: "absolute",
    bottom: 180,
    left: 16,
    right: 16,
    backgroundColor: "rgba(220,38,38,0.92)",
    borderRadius: 12,
    padding: 12,
    zIndex: 6,
  },
  errorText: { color: "white", fontSize: 14, fontWeight: "600" },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: "center",
    gap: 10,
    zIndex: 5,
  },
  hint: { color: "white", fontSize: 13, fontWeight: "600", textShadowColor: "black", textShadowRadius: 3 },

  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  shutterRecording: { borderColor: "#dc2626" },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#dc2626" },
  shutterStopInner: { width: 28, height: 28, borderRadius: 4, backgroundColor: "#dc2626" },

  // Result view
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#fffbf5",
    borderBottomWidth: 1,
    borderBottomColor: "#f1e9d8",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  resultImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    marginBottom: 16,
  },
  verdictLabel: { fontSize: 11, color: "#64748b", fontWeight: "700", marginBottom: 4 },
  verdictText: { fontSize: 17, color: "#0f172a", lineHeight: 24, marginBottom: 16 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sumChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "white",
  },
  sumN: { fontSize: 14, fontWeight: "800" },
  sumLabel: { fontSize: 12, color: "#334155" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    padding: 16,
    backgroundColor: "#fffbf5",
    borderTopWidth: 1,
    borderTopColor: "#f1e9d8",
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  footerBtnGhost: { backgroundColor: "#f1f5f9" },
  footerBtnGhostText: { color: "#475569", fontWeight: "700" },
  footerBtnPrimary: { backgroundColor: "#2563eb" },
  footerBtnPrimaryText: { color: "white", fontWeight: "700", fontSize: 15 },
});
