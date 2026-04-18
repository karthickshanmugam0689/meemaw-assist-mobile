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

export function SettingsPanel({
  mode,
  onModeChange,
  onClose,
}: {
  mode: EngineMode;
  onModeChange: (m: EngineMode) => void;
  onClose: () => void;
}) {
  const [downloaded, setDownloaded] = useState(isModelDownloaded());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    setDownloaded(isModelDownloaded());
  }, [downloading]);

  const startDownload = async () => {
    setDownloading(true);
    setProgress({ bytesWritten: 0, totalBytes: null });
    try {
      await downloadModel((p) => setProgress(p));
      setDownloaded(true);
      Alert.alert("Model ready", "Meemaw can now work without the internet.");
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
});
