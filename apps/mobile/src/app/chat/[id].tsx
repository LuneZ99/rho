import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  View,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  Pressable,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEntities, useStore } from "../../lib/store";
import { Text, Input, Button, Status, Empty } from "../../components/ui";
import { colors, font } from "../../theme";
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
  const atBottom = useRef(true);
  const dragging = useRef(false);
  const [showLatest, setShowLatest] = useState(false);
  function latest() {
    atBottom.current = true;
    setShowLatest(false);
    list.current?.scrollToEnd({ animated: false });
  }
  useEffect(() => {
    atBottom.current = true;
    setShowLatest(false);
  }, [id]);
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
      latest();
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
  const turnTime = new Map(
    messages
      .filter((m) => m.data.role === "user")
      .map((m) => [m.data.jobId, m.data.createdAt ?? m.updatedAt]),
  );
  const timestamp = (m: (typeof messages)[number]) =>
    m.data.createdAt ?? turnTime.get(m.data.jobId) ?? m.updatedAt;
  const dateLabel = (value: string) =>
    new Date(value).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const replying = jobs.some((j) =>
    ["queued", "running"].includes(j.data.status),
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="height"
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen
        options={{
          title: conversation?.data.title ?? "对话",
          headerTitle: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="选择此对话的模型"
              onPress={() =>
                router.push({
                  pathname: "/models",
                  params: { conversationId: id },
                })
              }
              style={{ minHeight: 48, justifyContent: "center", maxWidth: 260 }}
            >
              <Text numberOfLines={1} style={{ fontFamily: font.medium }}>
                {conversation?.data.title ?? "对话"}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text
                  numberOfLines={1}
                  muted
                  style={{ fontSize: 12, lineHeight: 18, flexShrink: 1 }}
                >
                  {conversation?.data.modelId ?? "同步后选择模型"}
                </Text>
                <MaterialIcons
                  name="expand-more"
                  size={18}
                  color={colors.muted}
                />
              </View>
            </Pressable>
          ),
        }}
      />
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onScrollEndDrag={() => {
          dragging.current = false;
        }}
        onMomentumScrollBegin={() => {
          dragging.current = true;
        }}
        onMomentumScrollEnd={() => {
          dragging.current = false;
        }}
        onScroll={({ nativeEvent: e }) => {
          // Layout and token updates also emit scroll events. Only a user's
          // scroll changes follow mode, otherwise initial layout can cancel it.
          if (!dragging.current) return;
          const bottom =
            e.contentSize.height -
              e.layoutMeasurement.height -
              e.contentOffset.y <
            80;
          atBottom.current = bottom;
          setShowLatest(!bottom);
        }}
        onLayout={() => {
          if (atBottom.current) list.current?.scrollToEnd({ animated: false });
        }}
        onContentSizeChange={() => {
          if (atBottom.current) list.current?.scrollToEnd({ animated: false });
        }}
        ListHeaderComponent={<Status />}
        ListEmptyComponent={
          s.ready ? (
            <Empty
              title="今天想记下什么？"
              body="可以说“今天喝了两杯咖啡”，也可以让我帮你安排一件事。"
            />
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={{ gap: 8 }}>
            {(index === 0 ||
              dateLabel(timestamp(messages[index - 1])) !==
                dateLabel(timestamp(item))) && (
              <View
                style={{
                  alignSelf: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 2,
                  marginVertical: 12,
                }}
              >
                <Text muted style={{ fontSize: 12 }}>
                  {dateLabel(timestamp(item))}
                </Text>
              </View>
            )}
            <View
              style={{
                alignSelf:
                  item.data.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                backgroundColor:
                  item.data.role === "user" ? colors.raised : colors.surface,
                borderRadius: 16,
                borderBottomRightRadius: item.data.role === "user" ? 4 : 16,
                borderBottomLeftRadius: item.data.role === "assistant" ? 4 : 16,
                paddingHorizontal: 14,
                paddingVertical: 10,
                gap: 4,
              }}
            >
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
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignSelf: "flex-end",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text muted style={{ fontSize: 11, lineHeight: 18 }}>
                  {item.data.state === "streaming"
                    ? "正在回复 · "
                    : item.data.state === "failed"
                      ? "未完成 · "
                      : ""}
                  {new Date(timestamp(item)).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </Text>
                {item.data.role === "user" && (
                  <MaterialIcons
                    name="check"
                    size={14}
                    color={colors.muted}
                    accessibilityLabel="已发送"
                  />
                )}
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 16 }}>
            {pending.map((p) => (
              <View
                key={p.id}
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "92%",
                  backgroundColor: colors.raised,
                  borderRadius: 16,
                  padding: 14,
                  gap: 4,
                }}
              >
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
      {showLatest && (
        <View
          style={{
            alignItems: "flex-end",
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <Button label="回到最新" secondary onPress={latest} />
        </View>
      )}
      <View
        style={{
          padding: 12,
          paddingBottom: keyboardShown ? 12 : Math.max(12, insets.bottom),
          borderTopWidth: 1,
          borderTopColor: colors.line,
          gap: 10,
        }}
      >
        {replying && (
          <Text
            muted
            accessibilityLiveRegion="polite"
            style={{ fontSize: 12, lineHeight: 18 }}
          >
            rho 正在回复…
          </Text>
        )}
        {(attached || attachedItem) && (
          <View style={{ gap: 8, flexDirection: "row", alignItems: "center" }}>
            <Text muted style={{ fontSize: 13, flex: 1 }}>
              已带入：
              {cards.find((c) => c.id === attached)?.data.title ??
                items.find((i) => i.id === attachedItem)?.data.title ??
                "所选内容"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="移除关联内容"
              onPress={() => {
                setAttached(undefined);
                setAttachedItem(undefined);
              }}
              style={{
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <Input
            accessibilityLabel="消息内容"
            placeholder="消息"
            multiline
            value={input}
            onChangeText={setInput}
            style={{
              maxHeight: 160,
              flex: 1,
              borderRadius: 24,
              paddingHorizontal: 18,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送"
            accessibilityState={{
              disabled: !input.trim() || !s.connection || sending,
              busy: sending,
            }}
            disabled={!input.trim() || !s.connection || sending}
            onPress={() => void send()}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.accent,
              opacity: !input.trim() || !s.connection || pressed ? 0.55 : 1,
            })}
          >
            {sending ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <MaterialIcons name="send" size={24} color={colors.onAccent} />
            )}
          </Pressable>
        </View>
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
