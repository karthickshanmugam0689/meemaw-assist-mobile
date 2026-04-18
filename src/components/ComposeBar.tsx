import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export type ComposeMode = "idle" | "listening" | "thinking" | "speaking";

export function ComposeBar({
  mode,
  pendingImage,
  onClearImage,
  onSendText,
  onMicPress,
  onCameraPress,
}: {
  mode: ComposeMode;
  pendingImage: string | null;
  onClearImage: () => void;
  onSendText: (text: string) => void;
  onMicPress: () => void;
  onCameraPress: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listening = mode === "listening";
  const busy = mode === "thinking" || mode === "speaking";
  const hasText = draft.trim().length > 0 || pendingImage !== null;

  const send = () => {
    const t = draft.trim();
    if (!t && !pendingImage) return;
    onSendText(t);
    setDraft("");
  };

  return (
    <View style={styles.wrap}>
      {pendingImage ? (
        <View style={styles.attachRow}>
          <Image source={{ uri: pendingImage }} style={styles.thumb} />
          <Pressable onPress={onClearImage} hitSlop={8} style={styles.removeBtn}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={
            pendingImage
              ? "What do you want to know about this?"
              : listening
              ? "Listening…"
              : "Type, or tap the mic to talk"
          }
          placeholderTextColor="#94a3b8"
          editable={!listening && !busy}
          multiline
          onSubmitEditing={send}
          returnKeyType="send"
        />

        {hasText ? (
          <Pressable
            onPress={send}
            disabled={busy}
            style={({ pressed }) => [
              styles.sendBtn,
              { opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={onCameraPress}
              disabled={busy || listening}
              hitSlop={8}
              style={({ pressed }) => [
                styles.cameraBtn,
                { opacity: busy || listening ? 0.4 : pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.cameraText}>📷</Text>
            </Pressable>
            <Pressable
              onPress={onMicPress}
              disabled={busy}
              style={({ pressed }) => [
                styles.micBtn,
                listening && styles.micBtnActive,
                { opacity: busy ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.micText}>{listening ? "■" : "🎤"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fffbf5",
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: 8,
    paddingLeft: 8,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
  },
  removeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -10,
    marginTop: -6,
  },
  removeText: { color: "white", fontSize: 14, fontWeight: "700", lineHeight: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 26,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 120,
  },
  cameraBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraText: { fontSize: 22 },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  micBtnActive: { backgroundColor: "#dc2626" },
  micText: { fontSize: 16, color: "white" },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  sendText: { color: "white", fontSize: 20, fontWeight: "700", lineHeight: 22 },
});
