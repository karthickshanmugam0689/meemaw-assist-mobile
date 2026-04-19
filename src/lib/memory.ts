import { Directory, File, Paths } from "expo-file-system";
import type { Region } from "./openai";

export type EmbeddingSource = "local" | "openai";

export type StoredImage = {
  /** File name inside Paths.document/photos/ */
  fileName: string;
  regions: Region[];
};

/** A single Q/A exchange inside a conversation. */
export type ConversationTurn = {
  id: string;
  query: string;
  reply: string;
  timestamp: number;
  embedding: number[];
  source: EmbeddingSource;
  dim: number;
  /** Present when this turn was a camera-with-description flow. */
  image?: StoredImage;
};

/** A whole conversation — one entry in history. */
export type Conversation = {
  id: string;
  startedAt: number;
  updatedAt: number;
  turns: ConversationTurn[];
};

const FILE_NAME = "memory.json";
const PHOTOS_DIR = "photos";

function file(): File {
  return new File(Paths.document, FILE_NAME);
}

function photosDir(): Directory {
  const d = new Directory(Paths.document, PHOTOS_DIR);
  if (!d.exists) d.create();
  return d;
}

/** Copy a resized JPEG (from ImageManipulator cache) into persistent storage.
 *  Returns the fileName (not path) to store in memory.json. */
export function savePhoto(sourceUri: string, turnId: string): string {
  const src = new File(sourceUri);
  const fileName = `${turnId}.jpg`;
  const dest = new File(photosDir(), fileName);
  if (dest.exists) dest.delete();
  src.copy(dest);
  return fileName;
}

/** Download a remote image (e.g. Kosi's annotated result) into persistent
 *  storage. Returns the fileName to store in memory.json. */
export async function saveRemotePhoto(
  url: string,
  turnId: string
): Promise<string> {
  const fileName = `${turnId}.jpg`;
  const dest = new File(photosDir(), fileName);
  if (dest.exists) dest.delete();
  await File.downloadFileAsync(url, dest, { idempotent: true });
  return fileName;
}

/** Resolve a stored photo back to a file:// URI the Image component can load. */
export function photoUri(fileName: string): string {
  return new File(photosDir(), fileName).uri;
}

function deletePhoto(fileName: string): void {
  const f = new File(photosDir(), fileName);
  if (f.exists) {
    try { f.delete(); } catch {}
  }
}

function readAll(): Conversation[] {
  const f = file();
  if (!f.exists) return [];
  try {
    const raw = f.textSync();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.conversations)) return [];
    return parsed.conversations.filter(
      (c: unknown): c is Conversation =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Conversation).id === "string" &&
        Array.isArray((c as Conversation).turns)
    );
  } catch {
    return [];
  }
}

function writeAll(conversations: Conversation[]): void {
  const f = file();
  if (!f.exists) f.create();
  f.write(JSON.stringify({ conversations }, null, 2));
}

export function loadConversations(): Conversation[] {
  // sorted newest-first for display convenience
  return readAll().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function findConversation(id: string): Conversation | null {
  return readAll().find((c) => c.id === id) ?? null;
}

export function startConversation(): Conversation {
  const now = Date.now();
  const conv: Conversation = {
    id: makeId(),
    startedAt: now,
    updatedAt: now,
    turns: [],
  };
  const all = readAll();
  all.push(conv);
  writeAll(all);
  return conv;
}

export function appendTurn(
  conversationId: string,
  turn: ConversationTurn
): Conversation | null {
  const all = readAll();
  const idx = all.findIndex((c) => c.id === conversationId);
  if (idx === -1) return null;
  all[idx].turns.push(turn);
  all[idx].updatedAt = turn.timestamp;
  writeAll(all);
  return all[idx];
}

export function deleteConversation(conversationId: string): void {
  const all = readAll();
  const target = all.find((c) => c.id === conversationId);
  if (target) {
    for (const t of target.turns) {
      if (t.image?.fileName) deletePhoto(t.image.fileName);
    }
  }
  writeAll(all.filter((c) => c.id !== conversationId));
}

export function clearAll(): void {
  const f = file();
  if (f.exists) f.delete();
  // Wipe the whole photos directory in one shot.
  const d = new Directory(Paths.document, PHOTOS_DIR);
  if (d.exists) {
    try { d.delete(); } catch {}
  }
}

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type SearchHit = {
  turn: ConversationTurn;
  conversationId: string;
  score: number;
};

// Embeddings from small general-purpose LLMs collapse "X not working" phrases
// together regardless of what X is. Cosine alone says "printer not working"
// ≈ "laptop not working" at 0.95 — useless for recall. We gate on device
// words: if both queries mention a device and the devices differ, skip.
const DEVICE_WORDS = [
  "laptop", "computer", "pc", "desktop",
  "phone", "mobile", "tablet", "ipad",
  "printer", "scanner",
  "tv", "television", "soundbar", "speaker", "headphones", "earbuds",
  "router", "modem", "wifi",
  "remote", "charger", "cable", "battery",
  "fridge", "microwave", "oven", "washer", "dryer",
  "camera", "watch",
];

function deviceTokens(text: string): Set<string> {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  for (const w of DEVICE_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(lower)) out.add(w);
  }
  return out;
}

function devicesCompatible(a: string, b: string): boolean {
  const da = deviceTokens(a);
  const db = deviceTokens(b);
  // If either side doesn't mention a device, fall through to embedding-only.
  if (da.size === 0 || db.size === 0) return true;
  // Both mention a device — require at least one in common.
  for (const d of da) if (db.has(d)) return true;
  return false;
}

/**
 * Flatten every turn across every conversation and search by cosine similarity.
 * `excludeConversationId` lets the caller skip the active conversation so the
 * "related" pill doesn't point at something the user just asked seconds ago.
 */
export function searchTurns(
  conversations: Conversation[],
  queryEmbedding: number[],
  source: EmbeddingSource,
  options: {
    topK?: number;
    minScore?: number;
    excludeConversationId?: string;
    queryText?: string;
  } = {}
): SearchHit[] {
  const topK = options.topK ?? 2;
  const minScore = options.minScore ?? 0.75;
  const queryText = options.queryText ?? "";
  const hits: SearchHit[] = [];
  for (const c of conversations) {
    if (options.excludeConversationId && c.id === options.excludeConversationId) {
      continue;
    }
    for (const t of c.turns) {
      if (t.source !== source || t.dim !== queryEmbedding.length) continue;
      if (queryText && !devicesCompatible(queryText, t.query)) continue;
      const score = cosine(queryEmbedding, t.embedding);
      if (score >= minScore) {
        hits.push({ turn: t, conversationId: c.id, score });
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function conversationTitle(c: Conversation, maxLen = 48): string {
  const first = c.turns[0]?.query?.trim();
  if (!first) return "Empty conversation";
  const clean = first.replace(/^📷\s*/, "");
  return clean.length > maxLen ? clean.slice(0, maxLen - 1) + "…" : clean;
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
