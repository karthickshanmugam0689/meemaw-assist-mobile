import { MEEMAW_SYSTEM_PROMPT, MEEMAW_VISION_PROMPT } from "./prompts";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type Region = { x: number; y: number; width: number; height: number; label: string };

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";
const BASE = "https://api.openai.com/v1";

const MODELS = {
  chat: process.env.EXPO_PUBLIC_OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
  vision: process.env.EXPO_PUBLIC_OPENAI_VISION_MODEL ?? "gpt-4o",
  stt: process.env.EXPO_PUBLIC_OPENAI_STT_MODEL ?? "whisper-1",
  tts: process.env.EXPO_PUBLIC_OPENAI_TTS_MODEL ?? "tts-1",
  voice: process.env.EXPO_PUBLIC_OPENAI_TTS_VOICE ?? "nova",
};

export function hasOpenAIKey(): boolean {
  return API_KEY.length > 0;
}

function requireKey(): string {
  if (!API_KEY) {
    throw new Error(
      "OpenAI key missing. Set EXPO_PUBLIC_OPENAI_API_KEY in .env or use on-device mode."
    );
  }
  return API_KEY;
}

export async function openaiChat(history: ChatMessage[]): Promise<string> {
  const key = requireKey();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODELS.chat,
      messages: [{ role: "system", content: MEEMAW_SYSTEM_PROMPT }, ...history],
      temperature: 0.7,
      max_tokens: 250,
    }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** Whisper transcription of an audio file URI (file://...). */
export async function openaiTranscribe(fileUri: string, mime = "audio/m4a"): Promise<string> {
  const key = requireKey();
  const form = new FormData();
  // @ts-expect-error - RN FormData accepts { uri, name, type }
  form.append("file", { uri: fileUri, name: "recording.m4a", type: mime });
  form.append("model", MODELS.stt);
  form.append("response_format", "json");

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`transcribe ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.text ?? "").trim();
}

/** Returns a base64-encoded MP3 of the TTS result. */
export async function openaiSpeak(text: string): Promise<string> {
  const key = requireKey();
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODELS.tts,
      voice: MODELS.voice,
      input: text,
      speed: 0.95,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`speak ${res.status}: ${await res.text()}`);
  const buf = await res.arrayBuffer();
  return arrayBufferToBase64(buf);
}

export type VisionResult = {
  explanation: string;
  regions: Region[];
  followup: string;
};

export async function openaiVision(
  imageBase64: string,
  history: ChatMessage[]
): Promise<VisionResult> {
  const key = requireKey();
  const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

  const messages = [
    { role: "system", content: MEEMAW_VISION_PROMPT },
    ...history.slice(-6),
    {
      role: "user",
      content: [
        { type: "text", text: "The user sent this photo. Look carefully and help them." },
        { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      ],
    },
  ];

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODELS.vision,
      messages,
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.5,
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${await res.text()}`);
  const data = await res.json();
  let parsed: Partial<VisionResult> = {};
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    parsed = {};
  }
  const regions = (parsed.regions ?? []).map((r) => ({
    x: clamp01(r.x),
    y: clamp01(r.y),
    width: clamp01(r.width),
    height: clamp01(r.height),
    label: (r.label ?? "").toString().slice(0, 40),
  }));
  return {
    explanation:
      (parsed.explanation ?? "").toString().trim() ||
      "I can see your picture. Let's look at it together.",
    regions,
    followup: (parsed.followup ?? "").toString().trim(),
  };
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : parseFloat(String(n));
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]
    );
  }
  return globalThis.btoa ? globalThis.btoa(binary) : Buffer.from(binary, "binary").toString("base64");
}
