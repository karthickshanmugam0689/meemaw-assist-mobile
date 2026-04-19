import { File, Paths } from "expo-file-system";

// Demo-time runtime override for the OpenAI chat + vision models. Persisted
// to a small JSON file so a pick in Settings survives app reloads. "auto"
// means defer to whatever EXPO_PUBLIC_OPENAI_*_MODEL env var is set (or the
// hard-coded default).

export type ChatModelChoice = "auto" | "gpt-4o-mini" | "gpt-5-mini" | "gpt-5";
export type VisionModelChoice = "auto" | "gpt-4o" | "gpt-5";

type Saved = {
  chat?: ChatModelChoice;
  vision?: VisionModelChoice;
};

const FILE_NAME = "model-override.json";

function file(): File {
  return new File(Paths.document, FILE_NAME);
}

function read(): Saved {
  const f = file();
  if (!f.exists) return {};
  try {
    return JSON.parse(f.textSync()) as Saved;
  } catch {
    return {};
  }
}

function write(s: Saved): void {
  const f = file();
  if (!f.exists) f.create();
  f.write(JSON.stringify(s));
}

export function getChatChoice(): ChatModelChoice {
  return read().chat ?? "auto";
}

export function setChatChoice(choice: ChatModelChoice): void {
  const cur = read();
  write({ ...cur, chat: choice });
}

export function getVisionChoice(): VisionModelChoice {
  return read().vision ?? "auto";
}

export function setVisionChoice(choice: VisionModelChoice): void {
  const cur = read();
  write({ ...cur, vision: choice });
}

export function resolveChatModel(choice: ChatModelChoice, envDefault: string): string {
  return choice === "auto" ? envDefault : choice;
}

export function resolveVisionModel(choice: VisionModelChoice, envDefault: string): string {
  return choice === "auto" ? envDefault : choice;
}

export const CHAT_CHOICES: { value: ChatModelChoice; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Use the .env default" },
  { value: "gpt-4o-mini", label: "GPT-4o mini", hint: "Fast, cheap baseline" },
  { value: "gpt-5-mini", label: "GPT-5 mini", hint: "Better instructions, low latency" },
  { value: "gpt-5", label: "GPT-5", hint: "Best quality, slower" },
];

export const VISION_CHOICES: { value: VisionModelChoice; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Use the .env default" },
  { value: "gpt-4o", label: "GPT-4o", hint: "Proven, fast" },
  { value: "gpt-5", label: "GPT-5", hint: "Stronger spatial reasoning" },
];
