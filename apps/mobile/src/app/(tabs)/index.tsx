import { useEffect, useState } from "react";
import { FlatList, View, Alert, RefreshControl } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { moduleNames, type Entity } from "@rho/shared";
import { useEntities, useStore } from "../../lib/store";
import {
  Text,
  Button,
  Panel,
  Empty,
  Status,
  pageStyle,
} from "../../components/ui";
import { colors } from "../../theme";
export default function Home() {
  const s = useStore(),
    items = useEntities("item"),
    allCards = useEntities("card");
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const next = allCards
      .filter((c) => !c.data.ignored && c.data.snoozedUntil)
      .map((c) => Date.parse(c.data.snoozedUntil!))
      .filter((at) => at > now)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(next - Date.now() + 50, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [allCards, now]);
  const cards = allCards
    .filter(
      (c) =>
        !c.data.ignored &&
        (!c.data.snoozedUntil || Date.parse(c.data.snoozedUntil) <= Date.now()),
    )
    .sort((a, b) => b.data.priority - a.data.priority);
  async function chat(card?: Entity<"card">, prompt?: string) {
    try {
      let id = card
        ? items.find((i) => i.id === card.data.itemId)?.data
            .sourceConversationId
        : null;
      if (!id) {
        id = randomUUID();
        await s.submit("conversation.create", {
          id,
          title: card?.data.title ?? "新的对话",
        });
      }
      s.audit("card.detail", card?.id);
      router.push({
        pathname: "/chat/[id]",
        params: {
          id,
          ...(card ? { cardId: card.id } : {}),
          ...(prompt ? { draft: prompt } : {}),
        },
      });
    } catch (e) {
      Alert.alert("暂时无法打开", String(e));
    }
  }
  async function act(c: Entity<"card">, action: "ignore" | "complete") {
    setBusy(c.id);
    try {
      await s.submit("card.action", { id: c.id, version: c.version, action });
    } catch (e) {
      Alert.alert("操作未保存", String(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <FlatList
      data={cards}
      keyExtractor={(c) => c.id}
      contentContainerStyle={pageStyle}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={s.syncing}
          onRefresh={s.sync}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Status />
          <Text muted>
            {new Date().toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </Text>
          <Text title>把值得关注的事，放在眼前</Text>
        </View>
      }
      ListEmptyComponent={
        s.ready ? (
          <Empty
            title="暂时没有需要处理的事"
            body="和 rho 说说今天，或交给它一件想记住的事。需要关注时，卡片会出现在这里。"
          />
        ) : null
      }
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      renderItem={({ item: c }) => {
        const item = items.find((i) => i.id === c.data.itemId);
        const pending = s.pending.some((p) => p.payload.id === c.id);
        return (
          <Panel>
            <Text muted style={{ fontSize: 13 }}>
              {item ? moduleNames[item.data.module] : "事项"}
            </Text>
            <Text title>{c.data.title}</Text>
            <Text selectable>{c.data.summary}</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {item?.data.kind === "task" && (
                <Button
                  label="完成"
                  disabled={pending || busy === c.id}
                  onPress={() => void act(c, "complete")}
                />
              )}
              <Button label="详细处理" secondary onPress={() => void chat(c)} />
              <Button
                label="稍后显示"
                secondary
                onPress={() => void chat(c, "我想让这张卡片稍后再显示，时间是")}
              />
              <Button
                label={pending ? "待同步" : "忽略"}
                secondary
                disabled={pending || busy === c.id}
                onPress={() => void act(c, "ignore")}
              />
            </View>
          </Panel>
        );
      }}
      ListFooterComponent={
        <View style={{ paddingTop: 20 }}>
          <Button
            label="和 rho 聊聊"
            disabled={!s.connection}
            onPress={() => void chat()}
          />
        </View>
      }
    />
  );
}
