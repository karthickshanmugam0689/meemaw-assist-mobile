import type { ChatMessage } from "./openai";
import { hasOpenAIKey, openaiChat } from "./openai";
import { isModelDownloaded, llamaChat } from "./llama";

export type EngineMode = "auto" | "online" | "ondevice";

export async function chatWithMode(
  history: ChatMessage[],
  mode: EngineMode
): Promise<{ reply: string; used: "openai" | "llama" }> {
  const canOnline = hasOpenAIKey();
  const canOnDevice = isModelDownloaded();

  if (mode === "online") {
    if (!canOnline) throw new Error("Online mode picked but no OpenAI key is set.");
    return { reply: await openaiChat(history), used: "openai" };
  }
  if (mode === "ondevice") {
    if (!canOnDevice) throw new Error("On-device mode picked but model isn't downloaded.");
    return { reply: await llamaChat(history), used: "llama" };
  }
  // auto: prefer online when we have a key, fall back to llama otherwise
  if (canOnline) {
    try {
      return { reply: await openaiChat(history), used: "openai" };
    } catch (err) {
      if (canOnDevice) return { reply: await llamaChat(history), used: "llama" };
      throw err;
    }
  }
  if (canOnDevice) return { reply: await llamaChat(history), used: "llama" };
  throw new Error(
    "No engine available. Add an OpenAI key or download the on-device model from Settings."
  );
}
