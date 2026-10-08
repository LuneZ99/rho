import { FlatList, View, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useEntities, useStore } from "../../lib/store";
import {
  Text,
  Button,
  Empty,
  Status,
  pageStyle,
  date,
} from "../../components/ui";
import { colors } from "../../theme";
export default function Conversations() {
  const s = useStore(),
    chats = useEntities("conversation").sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    ),
    messages = useEntities("message");
  async function create() {
    try {
      const id = randomUUID();
      await s.submit("conversation.create", {
        id,
        title: `对话 · ${date(Date.now())}`,
      });
      router.push({ pathname: "/chat/[id]", params: { id } });
    } catch (e) {
      Alert.alert("创建失败", String(e));
    }
  }
  return (
    <FlatList
      data={chats}
      keyExtractor={(c) => c.id}
      contentContainerStyle={pageStyle}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Status />
          <Button
            label="开启新对话"
            disabled={!s.connection}
            onPress={() => void create()}
          />
          <Text muted>每段对话都能处理健康、投资和待办。</Text>
        </View>
      }
      ListEmptyComponent={
        s.ready ? (
          <Empty
            title="从一句话开始"
            body="记下今天的状态，或安排接下来想做的事。"
          />
        ) : null
      }
      renderItem={({ item }) => {
        const last = messages
          .filter((m) => m.data.conversationId === item.id)
          .at(-1);
        return (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              s.audit("conversation.open", item.id);
              router.push({ pathname: "/chat/[id]", params: { id: item.id } });
            }}
            style={({ pressed }) => ({
              paddingVertical: 20,
              gap: 6,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text title>{item.data.title}</Text>
            <Text muted numberOfLines={2}>
              {last?.data.text || "还没有消息"}
            </Text>
            <Text muted style={{ fontSize: 13 }}>
              {date(item.updatedAt)}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}
