import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  View,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEntities, useStore } from "../../lib/store";
import { Text, Input, Button, Status, Empty } from "../../components/ui";
import { colors, font, space } from "../../theme";
export default function Chat() {
  const { id, cardId, itemId, draft } = useLocalSearchParams<{
    id: string;
    cardId?: string;
    itemId?: string;
    draft?: string;
  }>();
  const [input, setInput] = useState(draft ?? ""),
    [sending, setSending] = useState(false),
    [attached, setAttached] = useState(cardId),
    [attachedItem, setAttachedItem] = useState(itemId);
  const s = useStore(),
    conversation = useEntities("conversation").find((c) => c.id === id),
    messages = useEntities("message").filter(
      (m) => m.data.conversationId === id,
    ),
    jobs = useEntities("job").filter((j) => j.data.conversationId === id),
    cards = useEntities("card"),
    items = useEntities("item");
  const insets = useSafeAreaInsets(),
    list = useRef<FlatList>(null);
  const headerHeight = useHeaderHeight();
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardShown(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    if (draft) setInput(draft);
    setAttached(cardId);
    setAttachedItem(itemId);
  }, [draft, cardId, itemId]);
  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await s.submit("message.send", {
        conversationId: id,
        text: input.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(attached ? { cardId: attached } : {}),
        ...(attachedItem ? { itemId: attachedItem } : {}),
      });
      setInput("");
      setAttached(undefined);
      setAttachedItem(undefined);
    } catch (e) {
      Alert.alert("消息未保存", String(e));
    } finally {
      setSending(false);
    }
  }
  const pending = s.pending.filter(
    (p) => p.action === "message.send" && p.payload.conversationId === id,
  );
  // 增量序号会随流式回复更新；用同轮用户消息的固定序号保持对话顺序。
  const turnOrder = new Map(
    messages
      .filter((m) => m.data.role === "user")
      .map((m) => [m.data.jobId, m.seq]),
  );
  messages.sort(
    (a, b) =>
      (turnOrder.get(a.data.jobId) ?? a.seq) -
        (turnOrder.get(b.data.jobId) ?? b.seq) ||
      Number(a.data.role === "assistant") - Number(b.data.role === "assistant"),
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="height"
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen options={{ title: conversation?.data.title ?? "对话" }} />
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.page, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          list.current?.scrollToEnd({ animated: false })
        }
        ListHeaderComponent={<Status />}
        ListEmptyComponent={
          s.ready ? (
            <Empty
              title="今天想记下什么？"
              body="可以说“今天喝了两杯咖啡”，也可以让我帮你安排一件事。"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.data.role === "user" ? "flex-end" : "stretch",
              maxWidth: item.data.role === "user" ? "92%" : "100%",
              backgroundColor:
                item.data.role === "user" ? colors.raised : "transparent",
              borderRadius: 16,
              padding: item.data.role === "user" ? 16 : 0,
              gap: 8,
            }}
          >
            <Text muted style={{ fontSize: 13 }}>
              {item.data.role === "user" ? "你" : "rho"}
            </Text>
            <Text selectable>
              {messageText(
                item.data.text ||
                  (item.data.state === "failed"
                    ? "这次处理没有完成。"
                    : item.data.state === "pending"
                      ? "等待处理…"
                      : "正在整理…"),
                item.data.role === "assistant",
              )}
            </Text>
            {item.data.state === "streaming" && (
              <Text muted style={{ fontSize: 13 }}>
                正在处理
              </Text>
            )}
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 16 }}>
            {pending.map((p) => (
              <View key={p.id}>
                <Text selectable>{String(p.payload.text)}</Text>
                <Text muted>{p.error ?? "已保存在手机，等待发送"}</Text>
              </View>
            ))}
            {jobs
              .filter((j) => ["failed", "interrupted"].includes(j.data.status))
              .map((j) => (
                <View key={j.id} style={{ gap: 8 }}>
                  <Text style={{ color: colors.error }}>{j.data.error}</Text>
                  <Button
                    label="检查进度并继续"
                    secondary
                    onPress={() =>
                      void s
                        .submit("job.resume", { id: j.id, version: j.version })
                        .catch((e) => Alert.alert("暂时无法继续", String(e)))
                    }
                  />
                </View>
              ))}
          </View>
        }
      />
      <View
        style={{
          padding: 16,
          paddingBottom: keyboardShown ? 16 : Math.max(16, insets.bottom),
          borderTopWidth: 1,
          borderTopColor: colors.line,
          gap: 10,
        }}
      >
        {(attached || attachedItem) && (
          <View style={{ gap: 4 }}>
            <Text muted style={{ fontSize: 13 }}>
              已带入：
              {cards.find((c) => c.id === attached)?.data.title ??
                items.find((i) => i.id === attachedItem)?.data.title ??
                "所选内容"}
            </Text>
            <Button
              label="移除关联内容"
              secondary
              onPress={() => {
                setAttached(undefined);
                setAttachedItem(undefined);
              }}
            />
          </View>
        )}
        <Input
          accessibilityLabel="消息内容"
          placeholder="说说你的想法…"
          multiline
          value={input}
          onChangeText={setInput}
          style={{ maxHeight: 160 }}
        />
        <Button
          label="发送"
          loading={sending}
          disabled={!input.trim() || !s.connection}
          onPress={() => void send()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function messageText(text: string, format: boolean) {
  if (!format) return text;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={index} style={{ fontFamily: font.medium }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}
