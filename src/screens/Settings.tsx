import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  deleteModel,
  downloadModel,
  isModelDownloaded,
  type DownloadProgress,
} from "../lib/llama";
import { hasOpenAIKey } from "../lib/openai";
import type { EngineMode } from "../lib/engine";
import { LANGUAGES, getLanguage } from "../lib/languages";
import {
  CHAT_CHOICES,
  VISION_CHOICES,
  getChatChoice,
  getVisionChoice,
  setChatChoice,
  setVisionChoice,
  type ChatModelChoice,
  type VisionModelChoice,
} from "../lib/modelOverride";

export function SettingsPanel({
  mode,
  onModeChange,
  language,
  onLanguageChange,
  onClose,
}: {
  mode: EngineMode;
  onModeChange: (m: EngineMode) => void;
  language: string;
  onLanguageChange: (code: string) => void;
  onClose: () => void;
}) {
  const [downloaded, setDownloaded] = useState(isModelDownloaded());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [chatChoice, setChatChoiceState] = useState<ChatModelChoice>(getChatChoice());
  const [visionChoice, setVisionChoiceState] = useState<VisionModelChoice>(getVisionChoice());

  const onChatPick = (c: ChatModelChoice) => {
    setChatChoice(c);
    setChatChoiceState(c);
  };
  const onVisionPick = (c: VisionModelChoice) => {
    setVisionChoice(c);
    setVisionChoiceState(c);
  };

  useEffect(() => {
    setDownloaded(isModelDownloaded());
  }, [downloading]);

  const startDownload = async () => {
    setDownloading(true);
    setProgress({ bytesWritten: 0, totalBytes: null });
    try {
      await downloadModel((p) => setProgress(p));
      setDownloaded(true);
      Alert.alert("Model ready", "FlashFix can now work without the internet.");
    } catch (e) {
      Alert.alert("Download failed", e instanceof Error ? e.message : "unknown error");
    } finally {
      setDownloading(false);
    }
  };

  const removeModel = async () => {
    await deleteModel();
    setDownloaded(false);
  };

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  const pct =
    progress && progress.totalBytes
      ? Math.round((progress.bytesWritten / progress.totalBytes) * 100)
      : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.close}>Done</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Language</Text>
      <Text style={styles.hint}>
        Pick how FlashFix should reply. “Auto-detect” follows whatever language
        you write in. Once you choose a language, FlashFix will speak and reply
        in it from then on.
      </Text>
      <Text style={styles.currentLang}>
        Current: {getLanguage(language).name}
        {getLanguage(language).nativeName !== getLanguage(language).name
          ? ` (${getLanguage(language).nativeName})`
          : ""}
      </Text>
      <View style={styles.langGrid}>
        {LANGUAGES.map((l) => {
          const selected = l.code === language;
          return (
            <Pressable
              key={l.code}
              onPress={() => onLanguageChange(l.code)}
              style={[styles.langBtn, selected && styles.langBtnActive]}
            >
              <Text
                style={[styles.langLabel, selected && styles.langLabelActive]}
              >
                {l.nativeName}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Engine</Text>
      <Text style={styles.hint}>
        {hasOpenAIKey()
          ? "OpenAI key detected. Cloud mode is available."
          : "No OpenAI key set. Only on-device mode will work."}
      </Text>

      <View style={styles.modeRow}>
        {(["auto", "online", "ondevice"] as EngineMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => onModeChange(m)}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
          >
            <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>
              {m === "ondevice" ? "on-device" : m}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Chat model (cloud)</Text>
      <Text style={styles.hint}>
        Which OpenAI model to use for text + voice replies. Higher-tier models
        follow the FlashFix persona more precisely but cost more and may be a
        touch slower.
      </Text>
      <View style={styles.modelCol}>
        {CHAT_CHOICES.map((c) => {
          const selected = c.value === chatChoice;
          return (
            <Pressable
              key={c.value}
              onPress={() => onChatPick(c.value)}
              style={[styles.modelBtn, selected && styles.modelBtnActive]}
            >
              <Text
                style={[styles.modelLabel, selected && styles.modelLabelActive]}
              >
                {c.label}
              </Text>
              <Text
                style={[styles.modelHint, selected && styles.modelHintActive]}
              >
                {c.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Vision model (photo overlay)</Text>
      <Text style={styles.hint}>
        Which model analyses photos and draws the red box. GPT-5 has stronger
        spatial reasoning; GPT-4o is proven and fast.
      </Text>
      <View style={styles.modelCol}>
        {VISION_CHOICES.map((c) => {
          const selected = c.value === visionChoice;
          return (
            <Pressable
              key={c.value}
              onPress={() => onVisionPick(c.value)}
              style={[styles.modelBtn, selected && styles.modelBtnActive]}
            >
              <Text
                style={[styles.modelLabel, selected && styles.modelLabelActive]}
              >
                {c.label}
              </Text>
              <Text
                style={[styles.modelHint, selected && styles.modelHintActive]}
              >
                {c.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>On-device model</Text>
      <Text style={styles.hint}>
        A ~400 MB model file (Qwen2.5 0.5B Instruct). Downloads once, runs offline.
      </Text>

      {downloaded ? (
        <View style={styles.row}>
          <Text style={styles.ready}>✓ Downloaded</Text>
          <Pressable onPress={removeModel} style={styles.dangerBtn}>
            <Text style={styles.dangerText}>Delete</Text>
          </Pressable>
        </View>
      ) : downloading ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.progressText}>
            {progress?.totalBytes
              ? `${pct}% · ${mb(progress.bytesWritten)} / ${mb(progress.totalBytes)}`
              : progress
              ? mb(progress.bytesWritten)
              : "starting…"}
          </Text>
        </View>
      ) : (
        <Pressable onPress={startDownload} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Download model</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fffbf5", paddingHorizontal: 16, paddingTop: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#b45309" },
  close: { color: "#2563eb", fontSize: 16, fontWeight: "600" },
  section: { fontSize: 14, fontWeight: "700", marginTop: 16, color: "#0f172a" },
  hint: { color: "#64748b", fontSize: 13, marginTop: 4, marginBottom: 10 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5f5",
  },
  modeBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  modeLabel: { color: "#0f172a", fontSize: 14 },
  modeLabelActive: { color: "white", fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  ready: { color: "#16a34a", fontWeight: "700", fontSize: 16 },
  progressText: { color: "#0f172a", fontSize: 14 },
  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "white", fontSize: 16, fontWeight: "700" },
  dangerBtn: {
    backgroundColor: "#fef2f2",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  dangerText: { color: "#dc2626", fontWeight: "600" },
  currentLang: { fontSize: 14, color: "#0f172a", marginBottom: 8, fontWeight: "600" },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    backgroundColor: "white",
  },
  langBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  langLabel: { color: "#0f172a", fontSize: 14 },
  langLabelActive: { color: "white", fontWeight: "700" },
  modelCol: { gap: 8, marginBottom: 8 },
  modelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    backgroundColor: "white",
  },
  modelBtnActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  modelLabel: { color: "#0f172a", fontSize: 15, fontWeight: "700" },
  modelLabelActive: { color: "white" },
  modelHint: { color: "#64748b", fontSize: 12, marginTop: 2 },
  modelHintActive: { color: "#dbeafe" },
});
