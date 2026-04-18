import type { ChatMessage } from "./openai";
import { hasOpenAIKey, openaiChat } from "./openai";
import { isModelDownloaded, llamaChat } from "./llama";

export type EngineMode = "auto" | "online" | "ondevice";

export type EngineResult = {
  reply: string;
  used: "openai" | "llama";
  /** Present when the online path decided to run a web search. */
  searchQuery?: string;
  /** True when the model decided the voice conversation has concluded. */
  sessionDone?: boolean;
};

export async function chatWithMode(
  history: ChatMessage[],
  mode: EngineMode
): Promise<EngineResult> {
  const canOnline = hasOpenAIKey();
  const canOnDevice = isModelDownloaded();

  if (mode === "online") {
    if (!canOnline) throw new Error("Online mode picked but no OpenAI key is set.");
    const res = await openaiChat(history);
    return {
      reply: res.text,
      used: "openai",
      searchQuery: res.searchQuery,
      sessionDone: res.sessionDone,
    };
  }
  if (mode === "ondevice") {
    if (!canOnDevice) throw new Error("On-device mode picked but model isn't downloaded.");
    return { reply: await llamaChat(history), used: "llama" };
  }
  if (canOnline) {
    try {
      const res = await openaiChat(history);
      return { reply: res.text, used: "openai", searchQuery: res.searchQuery };
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
