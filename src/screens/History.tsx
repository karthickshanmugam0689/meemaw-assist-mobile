import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  clearAll,
  conversationTitle,
  deleteConversation,
  loadConversations,
  photoUri,
  type Conversation,
} from "../lib/memory";

export function HistoryScreen({
  onClose,
  onStartNew,
  onOpen,
}: {
  onClose: () => void;
  onStartNew: () => void;
  onOpen: (conversationId: string) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setConversations(loadConversations());
  }, []);

  const refresh = () => setConversations(loadConversations());

  const onClear = () => {
    Alert.alert("Clear all history?", "This removes every saved conversation.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearAll();
          setConversations([]);
        },
      },
    ]);
  };

  const onDeleteOne = (id: string) => {
    Alert.alert("Delete this conversation?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteConversation(id);
          refresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={onStartNew} style={styles.newBtn}>
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>
            When you ask FlashFix a question, the conversation is saved to your
            phone. Nothing is sent anywhere.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
          {conversations.map((c) => {
            const isOpen = expandedId === c.id;
            const turnCount = c.turns.length;
            return (
              <View key={c.id} style={styles.card}>
                <Pressable
                  onPress={() => setExpandedId(isOpen ? null : c.id)}
                  style={({ pressed }) => [
                    styles.cardHead,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{conversationTitle(c)}</Text>
                    <View style={styles.cardMeta}>
                      <Text style={styles.date}>{formatDate(c.updatedAt)}</Text>
                      <Text style={styles.chip}>
                        {turnCount} {turnCount === 1 ? "turn" : "turns"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
                </Pressable>

                {isOpen ? (
                  <View style={styles.turnList}>
                    <Pressable
                      onPress={() => onOpen(c.id)}
                      style={({ pressed }) => [
                        styles.openBtn,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={styles.openText}>↪ Open this conversation</Text>
                    </Pressable>
                    {c.turns.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => onOpen(c.id)}
                        style={({ pressed }) => [
                          styles.turn,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        {t.image ? (
                          <Image
                            source={{ uri: photoUri(t.image.fileName) }}
                            style={styles.turnThumb}
                          />
                        ) : null}
                        <Text style={styles.turnQuery}>{t.query}</Text>
                        <Text style={styles.turnReply}>{t.reply}</Text>
                        <View style={styles.turnMeta}>
                          <Text style={styles.turnDate}>
                            {formatDate(t.timestamp)}
                          </Text>
                          <Text style={styles.source}>
                            {t.source === "local" ? "on-device" : "cloud"}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => onDeleteOne(c.id)}
                      style={styles.deleteBtn}
                    >
                      <Text style={styles.deleteText}>Delete this conversation</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {conversations.length > 0 ? (
        <Pressable onPress={onClear} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear all history</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  return `${d.toLocaleDateString()} at ${time}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fffbf5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1e9d8",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  close: { color: "#2563eb", fontSize: 16, fontWeight: "600" },
  newBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#2563eb",
  },
  newBtnText: { color: "white", fontSize: 13, fontWeight: "700" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  emptyText: { textAlign: "center", color: "#64748b", lineHeight: 22 },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { fontSize: 12, color: "#94a3b8" },
  chip: {
    fontSize: 11,
    color: "#64748b",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  chevron: { fontSize: 16, color: "#94a3b8", width: 18, textAlign: "center" },
  turnList: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 10,
  },
  turn: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
  },
  turnThumb: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#e2e8f0",
  },
  turnQuery: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  turnReply: { fontSize: 13, color: "#334155", lineHeight: 19 },
  turnMeta: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  turnDate: { fontSize: 11, color: "#94a3b8" },
  source: {
    fontSize: 10,
    color: "#64748b",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: "hidden",
  },
  openBtn: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  openText: { color: "white", fontSize: 14, fontWeight: "700" },
  deleteBtn: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  deleteText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
  clearBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    alignItems: "center",
  },
  clearText: { color: "#dc2626", fontWeight: "700" },
});
