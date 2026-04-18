export type Language = {
  /** Stable identifier used in app state. "auto" means "detect from user". */
  code: string;
  /** English display name. */
  name: string;
  /** Native-script display name shown in the picker. */
  nativeName: string;
  /** BCP-47 tag handed to expo-speech for TTS. Undefined when code is "auto". */
  ttsCode?: string;
};

export const LANGUAGES: Language[] = [
  { code: "auto", name: "Auto-detect", nativeName: "Auto" },
  { code: "en", name: "English", nativeName: "English", ttsCode: "en-US" },
  { code: "es", name: "Spanish", nativeName: "Español", ttsCode: "es-ES" },
  { code: "fr", name: "French", nativeName: "Français", ttsCode: "fr-FR" },
  { code: "de", name: "German", nativeName: "Deutsch", ttsCode: "de-DE" },
  { code: "it", name: "Italian", nativeName: "Italiano", ttsCode: "it-IT" },
  { code: "pt", name: "Portuguese", nativeName: "Português", ttsCode: "pt-PT" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", ttsCode: "nl-NL" },
  { code: "pl", name: "Polish", nativeName: "Polski", ttsCode: "pl-PL" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", ttsCode: "tr-TR" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", ttsCode: "sk-SK" },
  { code: "ru", name: "Russian", nativeName: "Русский", ttsCode: "ru-RU" },
  { code: "ar", name: "Arabic", nativeName: "العربية", ttsCode: "ar-SA" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", ttsCode: "hi-IN" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", ttsCode: "ta-IN" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", ttsCode: "bn-IN" },
  { code: "zh", name: "Chinese", nativeName: "中文", ttsCode: "zh-CN" },
  { code: "ja", name: "Japanese", nativeName: "日本語", ttsCode: "ja-JP" },
  { code: "ko", name: "Korean", nativeName: "한국어", ttsCode: "ko-KR" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", ttsCode: "vi-VN" },
  { code: "th", name: "Thai", nativeName: "ไทย", ttsCode: "th-TH" },
];

export function getLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** A short system-level instruction to pin the model's reply language.
 *  Returns null when the language is "auto" — the persona prompt's own
 *  language-mirroring rule kicks in instead. */
export function languageSystemMessage(code: string): string | null {
  if (code === "auto") return null;
  const lang = getLanguage(code);
  return `IMPORTANT: The user has set their preferred language to ${lang.name} (${lang.nativeName}). Always respond in ${lang.name} from now on, no matter what language the user writes in. Keep every other part of your persona — warm, short sentences, one step at a time.`;
}
