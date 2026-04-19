import { MEEMAW_SYSTEM_PROMPT, MEEMAW_VISION_PROMPT } from "./prompts";
import {
  getChatChoice,
  getVisionChoice,
  resolveChatModel,
  resolveVisionModel,
} from "./modelOverride";

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

export type ChatResult = {
  text: string;
  /** Present when the model chose to run a web search during this turn. */
  searchQuery?: string;
  /** True when the model decided the voice conversation is over — the UI
   *  should speak the final reply then exit voice mode automatically. */
  sessionDone?: boolean;
};

/** JSON schema the model must conform to. Strict mode means every assistant
 *  turn returns exactly these two fields — no free-form text to mis-parse,
 *  no missed session-ends. */
const REPLY_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  required: ["reply", "end"],
  properties: {
    reply: {
      type: "string",
      description:
        "The warm plain-English text FlashFix says. Obeys every persona rule: short sentences, one step at a time, no markdown.",
    },
    end: {
      type: "boolean",
      description:
        "true when the voice conversation has clearly concluded (user said thanks, goodbye, issue resolved). false otherwise.",
    },
  },
};

async function postResponses(body: Record<string, unknown>, key: string): Promise<any> {
  const res = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * One call, one JSON reply.
 *
 * Uses OpenAI's Responses API with `web_search_preview` (so the model can
 * pick up current info when needed) and a strict JSON schema on the output.
 * The schema guarantees three fields on every reply — no tool-call loops,
 * no prompt-engineering bargaining, no confabulated "buttons" that don't
 * render. If the model wants to show a Maps button, it sets `findNearby`.
 * If the voice conversation is over, it sets `end: true`. Otherwise both
 * are null/false and only `reply` drives the UI.
 */
// GPT-5 / o-series are reasoning models: they ignore `temperature`, burn
// output tokens on internal reasoning, and need way more token headroom.
function isReasoningModel(model: string): boolean {
  return model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3");
}

function supportsTemperature(model: string): boolean {
  return !isReasoningModel(model);
}

export async function openaiChat(history: ChatMessage[]): Promise<ChatResult> {
  const key = requireKey();
  const chatModel = resolveChatModel(getChatChoice(), MODELS.chat);
  const reasoning = isReasoningModel(chatModel);
  const data = await postResponses(
    {
      model: chatModel,
      instructions: MEEMAW_SYSTEM_PROMPT,
      input: history.map((m) => ({ role: m.role, content: m.content })),
      tools: [{ type: "web_search_preview" }],
      text: {
        format: {
          type: "json_schema",
          name: "meemaw_reply",
          strict: true,
          schema: REPLY_SCHEMA,
        },
      },
      // Lower temp = tighter adherence to the persona/jargon rules.
      ...(supportsTemperature(chatModel) ? { temperature: 0.4 } : {}),
      // Reasoning models silently eat output budget on internal thinking;
      // "minimal" keeps replies fast AND gives the 600-token budget back.
      ...(reasoning ? { reasoning: { effort: "medium" } } : {}),
      // Reasoning still reserves SOME budget, so give it more headroom.
      max_output_tokens: reasoning ? 4000 : 600,
    },
    key
  );

  // Capture a web-search query for the chip, if one happened.
  let searchQuery: string | undefined;
  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    if (item?.type === "web_search_call") {
      const q = item?.action?.query;
      if (typeof q === "string" && q.trim()) searchQuery = q.trim();
      break;
    }
  }

  // Collect the JSON text of the final message (strict schema guarantees
  // it's valid JSON matching REPLY_SCHEMA).
  let rawJson = "";
  for (const item of output) {
    if (item?.type !== "message") continue;
    const parts = Array.isArray(item.content) ? item.content : [];
    for (const p of parts) {
      if (p?.type === "output_text" && typeof p.text === "string") {
        rawJson += p.text;
      }
    }
  }
  if (!rawJson && typeof data.output_text === "string") rawJson = data.output_text;

  let parsed: { reply?: string; end?: boolean } = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    // If JSON parsing fails (rare with strict mode), degrade by pulling out
    // the first `reply` string we can find. Avoids showing raw `{"reply":…}`
    // in the chat bubble.
    const match = rawJson.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const fallback = match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") : rawJson.trim();
    return { text: fallback, searchQuery };
  }

  return {
    text: (parsed.reply ?? "").trim(),
    searchQuery,
    sessionDone: parsed.end === true ? true : undefined,
  };
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
  history: ChatMessage[],
  userAsk?: string
): Promise<VisionResult> {
  const key = requireKey();
  const visionModel = resolveVisionModel(getVisionChoice(), MODELS.vision);
  const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

  const askText =
    userAsk && userAsk.trim()
      ? `The user is asking: "${userAsk.trim()}". Look at the photo and put your red box on EXACTLY what they asked about. If it isn't visible, return empty regions and ask for another angle.`
      : "The user sent this photo. Look carefully and help them.";

  const messages = [
    { role: "system", content: MEEMAW_VISION_PROMPT },
    ...history.slice(-6),
    {
      role: "user",
      content: [
        { type: "text", text: askText },
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
      model: visionModel,
      messages,
      response_format: { type: "json_object" },
      // Reasoning vision models need more headroom than classic gpt-4o.
      max_tokens: isReasoningModel(visionModel) ? 4000 : 500,
      ...(supportsTemperature(visionModel) ? { temperature: 0.5 } : {}),
      ...(isReasoningModel(visionModel)
        ? { reasoning_effort: "medium" }
        : {}),
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
