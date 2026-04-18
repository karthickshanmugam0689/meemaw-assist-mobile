import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is missing. Copy .env.local.example to .env.local and paste the key from the Hack Kosice Discord."
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export const MODELS = {
  chat: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
  // Vision needs the full gpt-4o — mini is noticeably worse at spatial reasoning
  vision: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
  stt: process.env.OPENAI_STT_MODEL ?? "whisper-1",
  tts: process.env.OPENAI_TTS_MODEL ?? "tts-1",
  voice: (process.env.OPENAI_TTS_VOICE ?? "nova") as
    | "alloy"
    | "echo"
    | "fable"
    | "onyx"
    | "nova"
    | "shimmer",
};
