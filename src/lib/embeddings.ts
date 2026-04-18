import { File, Paths } from "expo-file-system";
import { initLlama, type LlamaContext } from "llama.rn";
import type { EmbeddingSource } from "./memory";
import { hasOpenAIKey } from "./openai";

const MODEL_FILENAME = "meemaw-model.gguf";

let embedCtx: LlamaContext | null = null;
let loading: Promise<LlamaContext> | null = null;

function modelPath(): string | null {
  const f = new File(Paths.document, MODEL_FILENAME);
  return f.exists ? f.uri.replace(/^file:\/\//, "") : null;
}

async function getLocalEmbedder(): Promise<LlamaContext> {
  if (embedCtx) return embedCtx;
  if (loading) return loading;
  const path = modelPath();
  if (!path) throw new Error("on-device model not downloaded");
  loading = initLlama({
    model: path,
    n_ctx: 512,
    n_gpu_layers: 0,
    embedding: true,
    pooling_type: "mean",
  }).then((c) => {
    embedCtx = c;
    loading = null;
    return c;
  });
  return loading;
}

/** Release the local embedder to free memory (useful on low-RAM devices). */
export async function releaseLocalEmbedder(): Promise<void> {
  if (embedCtx) {
    const c = embedCtx;
    embedCtx = null;
    await c.release();
  }
}

async function openaiEmbed(text: string): Promise<number[]> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}

export type EmbedResult = { embedding: number[]; source: EmbeddingSource };

/**
 * Embed a string using the best available method.
 * Strategy: local llama.rn if model is downloaded, else OpenAI.
 * The caller gets back both the vector and the source so stored vectors
 * can be compared only with matching ones.
 */
export async function embed(text: string): Promise<EmbedResult> {
  const path = modelPath();
  if (path) {
    try {
      const ctx = await getLocalEmbedder();
      const res = await ctx.embedding(text);
      if (res.embedding && res.embedding.length > 0) {
        return { embedding: res.embedding, source: "local" };
      }
    } catch (err) {
      // fall through to OpenAI
      console.warn("local embed failed, falling back to OpenAI", err);
    }
  }
  if (hasOpenAIKey()) {
    const vec = await openaiEmbed(text);
    return { embedding: vec, source: "openai" };
  }
  throw new Error(
    "No embedder available: download the on-device model or set EXPO_PUBLIC_OPENAI_API_KEY."
  );
}

export function canEmbed(): boolean {
  return modelPath() !== null || hasOpenAIKey();
}
