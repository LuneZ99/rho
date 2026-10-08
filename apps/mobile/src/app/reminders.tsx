import { FlatList, Pressable } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { Text, Empty, pageStyle, date } from "../components/ui";
import { colors } from "../theme";
export default function History() {
  const s = useStore();
  const rows = [...(s.reminders?.history ?? [])].sort((a, b) => b.at - a.at);
  return (
    <FlatList
      contentContainerStyle={pageStyle}
      data={rows}
      keyExtractor={(r) => r.key}
      ListHeaderComponent={
        <Text muted>
          本机已发送的提醒。错过的提醒会合并通知，原事项仍保留。
        </Text>
      }
      ListEmptyComponent={
        <Empty title="还没有提醒记录" body="可以在对话中安排一条提醒。" />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/item/[id]", params: { id: item.itemId } })
          }
          style={{
            paddingVertical: 20,
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <Text title>{item.title}</Text>
          <Text muted>
            {date(item.at)} · {item.missed ? "已补发" : "已发送"}
          </Text>
        </Pressable>
      )}
    />
  );
}
