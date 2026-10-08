import { ScrollView, View, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { moduleNames } from "@rho/shared";
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
export default function Item() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    s = useStore();
  const item = useEntities("item").find((i) => i.id === id),
    reminders = useEntities("reminder").filter(
      (r) => r.data.itemId === id && r.data.active,
    );
  async function discuss() {
    if (!item) return;
    try {
      let chatId = item.data.sourceConversationId;
      if (!chatId) {
        chatId = randomUUID();
        await s.submit("conversation.create", {
          id: chatId,
          title: item.data.title,
        });
      }
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: chatId,
          itemId: item.id,
          draft: `关于“${item.data.title}”，`,
        },
      });
    } catch (e) {
      Alert.alert("无法打开对话", String(e));
    }
  }
  return (
    <ScrollView
      contentContainerStyle={pageStyle}
      keyboardShouldPersistTaps="handled"
    >
      <Status />
      {!item ? (
        <Empty title="记录暂不可用" body="这条记录可能尚未同步，或已被删除。" />
      ) : (
        <>
          <Text muted>
            {moduleNames[item.data.module]} · {item.data.category}
          </Text>
          <Text title>{item.data.title}</Text>
          <Text muted>
            {date(item.data.occurredAt)}
            {item.data.kind === "task"
              ? ` · ${item.data.status === "completed" ? "已完成" : "进行中"}`
              : ""}
          </Text>
          <Text selectable>{item.data.content}</Text>
          {Object.entries(item.data.fields).map(([key, value]) => (
            <View
              key={key}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
                paddingVertical: 10,
                gap: 4,
              }}
            >
              <Text muted>{key}</Text>
              <Text selectable>
                {typeof value === "object"
                  ? JSON.stringify(value, null, 2)
                  : String(value)}
              </Text>
            </View>
          ))}
          <Text title>最初的记录</Text>
          <Text selectable muted>
            {item.data.originalText}
          </Text>
          {reminders.map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              <Text>
                {r.data.title} · {date(r.data.at)}
              </Text>
              <Text muted>
                {r.data.repeat === "once"
                  ? "单次"
                  : r.data.repeat === "daily"
                    ? "每天"
                    : "每周"}{" "}
                ·{" "}
                {r.data.repeat === "once" &&
                s.reminders?.receipts.some((key) =>
                  key.startsWith(`${r.id}:${r.version}:`),
                )
                  ? "已发送通知"
                  : s.reminders?.notificationPermission &&
                      s.reminders?.installedReminderVersions[r.id] === r.version
                    ? s.reminders.exactAlarmPermission
                      ? "已在手机安排通知"
                      : "已安排，精确提醒权限未开启"
                    : "已保存，等待手机安排通知"}
              </Text>
            </View>
          ))}
          <Button
            label="通过对话修改或继续处理"
            onPress={() => void discuss()}
          />
        </>
      )}
    </ScrollView>
  );
}
