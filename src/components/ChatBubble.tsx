import { Pressable, StyleSheet, Text, View } from "react-native";

export function ChatBubble({
  role,
  text,
  onReplay,
}: {
  role: "user" | "assistant";
  text: string;
  onReplay?: () => void;
}) {
  const isUser = role === "user";
  return (
    <View style={[styles.wrap, isUser ? styles.wrapUser : styles.wrapAssistant]}>
      <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {text}
        </Text>
      </View>
      <View style={[styles.meta, isUser ? styles.metaUser : styles.metaAssistant]}>
        {isUser ? (
          <>
            {onReplay ? (
              <Pressable onPress={onReplay} hitSlop={8} style={styles.iconBtn}>
                <Text style={styles.iconText}>🔊</Text>
              </Pressable>
            ) : null}
            <View style={[styles.avatar, styles.avatarUser]}>
              <Text style={styles.avatarUserText}>You</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.avatar, styles.avatarAssistant]}>
              <Text style={styles.avatarAssistantText}>M</Text>
            </View>
            {onReplay ? (
              <Pressable onPress={onReplay} hitSlop={8} style={styles.iconBtn}>
                <Text style={styles.iconText}>🔊</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6 },
  wrapUser: { alignItems: "flex-end" },
  wrapAssistant: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "88%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  user: { backgroundColor: "#2563eb" },
  assistant: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" },
  text: { fontSize: 17, lineHeight: 25 },
  userText: { color: "white" },
  assistantText: { color: "#0f172a" },
  meta: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 },
  metaUser: { justifyContent: "flex-end" },
  metaAssistant: { justifyContent: "flex-start" },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarAssistant: { backgroundColor: "#fde8c8" },
  avatarAssistantText: { color: "#b45309", fontWeight: "700", fontSize: 13 },
  avatarUser: { backgroundColor: "#dbeafe" },
  avatarUserText: { color: "#2563eb", fontWeight: "700", fontSize: 11 },
  iconBtn: {
    minWidth: 28,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  iconText: { fontSize: 13 },
});
