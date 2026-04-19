import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "../lib/i18n";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export function VoiceModeScreen({
  state,
  lastUserMessage,
  lastReply,
  onTapCircle,
  onExit,
  diagnosticsEnabled,
  onDiagnostics,
  onRecordPhoto,
  onUploadPhoto,
  onLiveAssist,
}: {
  state: VoiceState;
  lastUserMessage: string | null;
  lastReply: string | null;
  onTapCircle: () => void;
  onExit: () => void;
  diagnosticsEnabled?: boolean;
  onDiagnostics?: () => void;
  onRecordPhoto?: () => void;
  onUploadPhoto?: () => void;
  onLiveAssist?: () => void;
}) {
  const t = useT();
  const [sheetOpen, setSheetOpen] = useState(false);

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
  const showShowProblem = Boolean(
    onRecordPhoto || onUploadPhoto || onLiveAssist
  );

  const pick = (fn?: () => void) => {
    setSheetOpen(false);
    if (fn) fn();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("voiceModeTitle")}</Text>
        <View style={styles.headerRight}>
          {diagnosticsEnabled && onDiagnostics ? (
            <Pressable
              onPress={onDiagnostics}
              hitSlop={10}
              style={({ pressed }) => [
                styles.diagChip,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.diagChipText}>{t("voiceDiagnostics")}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onExit} hitSlop={10} style={styles.exitBtn}>
            <Text style={styles.exitText}>✕</Text>
          </Pressable>
        </View>
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

      {showShowProblem ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [
            styles.showProblemBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.showProblemText}>{t("voiceShowProblem")}</Text>
        </Pressable>
      ) : null}

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
            <Text style={styles.msgLabel}>FlashFix</Text>
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

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setSheetOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t("voiceSheetTitle")}</Text>
            <Text style={styles.sheetHint}>{t("voiceSheetHint")}</Text>

            {onRecordPhoto ? (
              <Pressable
                onPress={() => pick(onRecordPhoto)}
                style={({ pressed }) => [
                  styles.tile,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.tileLabel}>{t("voiceTakePhoto")}</Text>
                <Text style={styles.tileHint}>{t("voiceTakePhotoHint")}</Text>
              </Pressable>
            ) : null}

            {onUploadPhoto ? (
              <Pressable
                onPress={() => pick(onUploadPhoto)}
                style={({ pressed }) => [
                  styles.tile,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.tileLabel}>{t("voiceUploadPhoto")}</Text>
                <Text style={styles.tileHint}>{t("voiceUploadPhotoHint")}</Text>
              </Pressable>
            ) : null}

            {onLiveAssist ? (
              <Pressable
                onPress={() => pick(onLiveAssist)}
                style={({ pressed }) => [
                  styles.tile,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.tileLabel}>{t("voiceLiveVideo")}</Text>
                <Text style={styles.tileHint}>{t("voiceLiveVideoHint")}</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setSheetOpen(false)}
              style={({ pressed }) => [
                styles.sheetCancel,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.sheetCancelText}>{t("voiceCancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  diagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5f5",
  },
  diagChipText: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
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
  showProblemBtn: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5f5",
    alignItems: "center",
  },
  showProblemText: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fffbf5",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sheetHint: { fontSize: 14, color: "#64748b", marginBottom: 4 },
  tile: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tileLabel: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  tileHint: { fontSize: 14, color: "#64748b", marginTop: 4 },
  sheetCancel: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  sheetCancelText: { fontSize: 15, fontWeight: "700", color: "#475569" },
});
