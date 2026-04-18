import { Pressable, StyleSheet, Text, View } from "react-native";

export function RelatedPill({
  query,
  score,
  onPress,
}: {
  query: string;
  score: number;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.icon}>💭</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>I remember a similar question</Text>
        <Text style={styles.query} numberOfLines={1}>
          “{query}”
        </Text>
      </View>
      <Text style={styles.score}>{Math.round(score * 100)}%</Text>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.wrap}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  icon: { fontSize: 16 },
  label: { fontSize: 12, color: "#92400e", fontWeight: "700" },
  query: { fontSize: 13, color: "#78350f", fontStyle: "italic" },
  score: { fontSize: 11, color: "#92400e", fontWeight: "700" },
  chevron: { fontSize: 20, color: "#92400e", fontWeight: "700" },
});
