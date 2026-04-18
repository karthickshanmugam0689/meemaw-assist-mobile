import { StyleSheet, Text, View } from "react-native";
import { useT } from "../lib/i18n";

/** Subtle grey chip shown below replies where the model ran a web search.
 *  Kept intentionally small and quiet — a whisper, not a shout. */
export function SearchChip({ query }: { query: string }) {
  const t = useT();
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🌐</Text>
      <Text style={styles.text} numberOfLines={1}>
        {t("lookedItUp")} · <Text style={styles.query}>“{query}”</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginLeft: 4,
    maxWidth: "85%",
  },
  icon: { fontSize: 11 },
  text: { fontSize: 11, color: "#475569" },
  query: { color: "#0f172a", fontWeight: "600" },
});
