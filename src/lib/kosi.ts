import type { Region } from "./openai";

/**
 * Client for the local Kosi FastAPI server. Expects an env var at build time:
 *   EXPO_PUBLIC_KOSI_URL=http://<your-mac-ip>:8000  (LAN)
 *   EXPO_PUBLIC_KOSI_URL=https://<something>.ngrok-free.app   (public)
 */
const BASE = (process.env.EXPO_PUBLIC_KOSI_URL ?? "").replace(/\/$/, "");

export function hasKosi(): boolean {
  return BASE.length > 0;
}

export type KosiStepTarget = {
  stepNumber: number;
  instruction: string;
  visualTarget: string;
};

export type KosiDetection = {
  label: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type KosiResult = {
  requestId: string;
  instructions: string;
  /** URL to the annotated image (boxes already drawn). Prefer displaying this. */
  imageUrl: string;
  originalImageUrl: string | null;
  croppedImageUrl: string | null;
  replyImageUrls: string[];
  imageWidth: number;
  imageHeight: number;
  /** Normalised 0–1 regions ready for our existing `AnnotatedImage` overlay. */
  regions: Region[];
  detections: KosiDetection[];
  stepTargets: KosiStepTarget[];
  unfoundTargets: string[];
  selectionMethod: string;
};

/**
 * POST /analyze to the Kosi server. `uri` can be a local file:// URI (typical
 * from expo-image-manipulator) or a remote URL. We stream the file via
 * multipart/form-data — React Native's FormData implementation accepts
 * `{ uri, name, type }` objects directly.
 */
export async function kosiAnalyze(
  imageUri: string,
  issue: string
): Promise<KosiResult> {
  if (!BASE) {
    throw new Error("Kosi server URL is not set. Add EXPO_PUBLIC_KOSI_URL to .env");
  }
  if (!issue.trim()) {
    throw new Error("Please tell FlashFix what you want to know about the photo.");
  }

  const form = new FormData();
  // @ts-expect-error - RN FormData accepts { uri, name, type }
  form.append("image", {
    uri: imageUri,
    name: "photo.jpg",
    type: "image/jpeg",
  });
  form.append("issue", issue.trim());

  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    body: form as unknown as BodyInit,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`kosi /analyze ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as KosiResult;
  return data;
}

export type KosiVideoFrame = {
  frame_index: number;
  timestamp_seconds: number;
  state: "connected" | "near" | "not_connected" | "inconclusive" | string;
  confidence: number;
  annotated_path: string;
  /** Server-rewritten URL (preferred); falls back to `annotated_path` if absent. */
  annotated_url?: string | null;
  frame_url?: string | null;
};

export type KosiVideoResult = {
  requestId: string;
  scenario: string;
  sampledFrames: number;
  summary: { connected: number; near: number; not_connected: number; inconclusive: number };
  assistantOutput: string;
  bestFrames: KosiVideoFrame[];
};

/**
 * Upload a short recorded video to /analyze_video. The server samples frames
 * every 0.5 s, runs YOLO + optional GPT-4o, and returns the best annotated
 * frames plus a plain-English verdict for FlashFix to speak.
 */
export async function kosiAnalyzeVideo(
  videoUri: string,
  issue: string
): Promise<KosiVideoResult> {
  if (!BASE) {
    throw new Error("Kosi server URL is not set. Add EXPO_PUBLIC_KOSI_URL to .env");
  }
  if (!issue.trim()) {
    throw new Error("Please tell FlashFix what you want to check in the video.");
  }
  const form = new FormData();
  // @ts-expect-error - RN FormData accepts { uri, name, type }
  form.append("video", {
    uri: videoUri,
    name: "clip.mp4",
    type: "video/mp4",
  });
  form.append("issue", issue.trim());

  const res = await fetch(`${BASE}/analyze_video`, {
    method: "POST",
    body: form as unknown as BodyInit,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`kosi /analyze_video ${res.status}: ${errText.slice(0, 200)}`);
  }
  return (await res.json()) as KosiVideoResult;
}

export type LiveDetection = {
  label: string;
  confidence: number;
  /** Normalised 0–1 relative to the captured frame. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type KosiLiveDetectResult = {
  imageWidth: number;
  imageHeight: number;
  detections: LiveDetection[];
};

/** Fast YOLO-only detect for the live-overlay loop. ~1 s per call on CPU. */
export async function kosiDetect(
  imageUri: string,
  issue: string
): Promise<KosiLiveDetectResult> {
  if (!BASE) {
    throw new Error("Kosi server URL is not set. Add EXPO_PUBLIC_KOSI_URL to .env");
  }
  const form = new FormData();
  // @ts-expect-error - RN FormData accepts { uri, name, type }
  form.append("image", { uri: imageUri, name: "frame.jpg", type: "image/jpeg" });
  form.append("issue", issue ?? "");

  const res = await fetch(`${BASE}/detect`, {
    method: "POST",
    body: form as unknown as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`kosi /detect ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as KosiLiveDetectResult;
}
