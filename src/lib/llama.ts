import { File, Paths } from "expo-file-system";
import { initLlama, type LlamaContext } from "llama.rn";
import { MEEMAW_LOCAL_SYSTEM_PROMPT } from "./prompts";
import type { ChatMessage } from "./openai";

/**
 * Default: Qwen2.5 0.5B Instruct q4_k_m — tiny (~400 MB), fast on mid-range phones.
 * Override with EXPO_PUBLIC_LLAMA_MODEL_URL to point to any GGUF on HuggingFace.
 */
const MODEL_URL =
  process.env.EXPO_PUBLIC_LLAMA_MODEL_URL ??
  "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";

const MODEL_FILENAME = "meemaw-model.gguf";

let ctx: LlamaContext | null = null;
let loading: Promise<LlamaContext> | null = null;

function modelFile(): File {
  return new File(Paths.document, MODEL_FILENAME);
}

export function isModelDownloaded(): boolean {
  return modelFile().exists;
}

export function isEngineLoaded(): boolean {
  return ctx !== null;
}

export type DownloadProgress = { bytesWritten: number; totalBytes: number | null };

export async function downloadModel(
  onProgress?: (p: DownloadProgress) => void
): Promise<string> {
  const target = modelFile();
  if (target.exists) return target.uri;

  // Probe Content-Length so we can show progress.
  let totalBytes: number | null = null;
  try {
    const head = await fetch(MODEL_URL, { method: "HEAD" });
    const len = head.headers.get("content-length");
    if (len) totalBytes = Number(len);
  } catch {
    // ignore — progress will just be indeterminate
  }

  let stopPolling = false;
  const poll = (async () => {
    while (!stopPolling) {
      await new Promise((r) => setTimeout(r, 500));
      const size = target.exists ? target.size : 0;
      onProgress?.({ bytesWritten: size, totalBytes });
    }
  })();

  try {
    await File.downloadFileAsync(MODEL_URL, target, { idempotent: true });
  } catch (e) {
    // If downloadFileAsync rejected, wipe any partial file so a retry is clean.
    stopPolling = true;
    await poll;
    if (target.exists) {
      try { target.delete(); } catch {}
    }
    throw e;
  }

  stopPolling = true;
  await poll;
  onProgress?.({ bytesWritten: target.size, totalBytes });
  return target.uri;
}

export async function deleteModel(): Promise<void> {
  if (ctx) {
    await ctx.release();
    ctx = null;
  }
  const f = modelFile();
  if (f.exists) f.delete();
}

export async function loadEngine(): Promise<LlamaContext> {
  if (ctx) return ctx;
  if (loading) return loading;
  const target = modelFile();
  if (!target.exists) throw new Error("model not downloaded");
  loading = initLlama({
    model: target.uri.replace(/^file:\/\//, ""),
    n_ctx: 4096,
    n_gpu_layers: 0,
    use_mlock: false,
  }).then((c) => {
    ctx = c;
    loading = null;
    return c;
  });
  return loading;
}

// The on-device model has a tight context window. Keep all system messages
// (system prompt, language pin, recall hint) but trim user/assistant turns to
// the most recent MAX_TURNS so long conversations don't blow the window.
const MAX_TURNS = 6;

function trimForLocal(history: ChatMessage[]): ChatMessage[] {
  const systems = history.filter((m) => m.role === "system");
  const convo = history.filter((m) => m.role !== "system");
  const recent = convo.slice(-MAX_TURNS);
  return [...systems, ...recent];
}

export async function llamaChat(history: ChatMessage[]): Promise<string> {
  const engine = await loadEngine();
  const trimmed = trimForLocal(history);
  const res = await engine.completion({
    messages: [{ role: "system", content: MEEMAW_LOCAL_SYSTEM_PROMPT }, ...trimmed],
    n_predict: 200,
    // Lower temp so the 0.5B model follows the compact persona prompt
    // instead of rambling off-script.
    temperature: 0.4,
    stop: ["</s>", "<|end|>", "<|im_end|>", "<|eot_id|>"],
  });
  return (res.text ?? "").trim();
}
