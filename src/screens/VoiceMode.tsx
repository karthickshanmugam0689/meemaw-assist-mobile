import { Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "../lib/i18n";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export function VoiceModeScreen({
  state,
  lastUserMessage,
  lastReply,
  onTapCircle,
  onExit,
}: {
  state: VoiceState;
  lastUserMessage: string | null;
  lastReply: string | null;
  onTapCircle: () => void;
  onExit: () => void;
}) {
  const t = useT();

  const emoji =
    state === "listening" ? "🎤" : state === "speaking" ? "🗣️" : "💭";
  const color =
    state === "listening"
      ? "#16a34a"
      : state === "speaking"
      ? "#2563eb"
      : "#b45309";
  const bg =
    state === "listening"
      ? "#dcfce7"
      : state === "speaking"
      ? "#dbeafe"
      : "#fef3c7";
  const label =
    state === "listening"
      ? t("voiceListening")
      : state === "speaking"
      ? t("voiceSpeaking")
      : state === "thinking"
      ? t("voiceThinking")
      : t("voiceSaySomething");

  const canTapToStop = state === "listening" || state === "speaking";

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("voiceModeTitle")}</Text>
        <Pressable onPress={onExit} hitSlop={10} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Pressable
          onPress={canTapToStop ? onTapCircle : undefined}
          style={({ pressed }) => [
            styles.circle,
            {
              backgroundColor: bg,
              borderColor: color,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Pressable>
        <Text style={[styles.stateLabel, { color }]}>{label}</Text>
        {canTapToStop ? (
          <Text style={styles.tapHint}>{t("voiceTapToStop")}</Text>
        ) : null}
      </View>

      <View style={styles.transcriptBlock}>
        {lastUserMessage ? (
          <View style={[styles.msg, styles.msgUser]}>
            <Text style={styles.msgLabel}>{t("youLabel")}</Text>
            <Text style={[styles.msgText, styles.msgTextUser]} numberOfLines={3}>
              {lastUserMessage}
            </Text>
          </View>
        ) : null}
        {lastReply ? (
          <View style={[styles.msg, styles.msgAssistant]}>
            <Text style={styles.msgLabel}>Meemaw</Text>
            <Text style={styles.msgText} numberOfLines={5}>
              {lastReply}
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onExit}
        style={({ pressed }) => [
          styles.footerBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.footerBtnText}>{t("voiceExit")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fffbf5", paddingHorizontal: 16, paddingTop: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  exitText: { fontSize: 16, color: "#475569", fontWeight: "700" },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 36 },
  circle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  emoji: { fontSize: 72 },
  stateLabel: { marginTop: 24, fontSize: 18, fontWeight: "700" },
  tapHint: { marginTop: 6, fontSize: 13, color: "#94a3b8" },
  transcriptBlock: { gap: 8, marginTop: 8 },
  msg: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  msgUser: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  msgAssistant: {
    backgroundColor: "white",
    borderColor: "#e2e8f0",
    alignSelf: "flex-start",
    maxWidth: "90%",
  },
  msgLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 4 },
  msgText: { fontSize: 15, color: "#0f172a", lineHeight: 22 },
  msgTextUser: { color: "white" },
  footerBtn: {
    marginTop: "auto",
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  footerBtnText: { color: "#475569", fontSize: 15, fontWeight: "700" },
});
