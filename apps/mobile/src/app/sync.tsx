import { ScrollView, View, Alert } from "react-native";
import { useStore } from "../lib/store";
import { Text, Button, Empty, pageStyle } from "../components/ui";
import { colors } from "../theme";
const names: Record<string, string> = {
  "message.send": "发送消息",
  "conversation.create": "新建对话",
  "card.action": "处理卡片",
  "job.resume": "继续任务",
  audit: "操作记录",
};
export default function Sync() {
  const s = useStore();
  return (
    <ScrollView contentContainerStyle={pageStyle}>
      <Text title>{s.error ? "有内容等待同步" : "你的内容已保存在手机"}</Text>
      {s.error && (
        <Text selectable style={{ color: colors.error }}>
          {s.error}
        </Text>
      )}
      <Text muted>
        断网后可以继续查看和输入。重新连接后会按顺序提交；冲突操作需要处理后才能继续。
      </Text>
      <Button
        label="立即同步"
        loading={s.syncing}
        onPress={() => void s.sync()}
      />
      {s.pending.length === 0 && (
        <Empty
          title="没有待提交操作"
          body="手机与服务端将在打开 App 时同步。"
        />
      )}
      {s.pending.map((p) => (
        <View
          key={p.id}
          style={{
            gap: 10,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <Text>{names[p.action] ?? p.action}</Text>
          {p.payload.text ? (
            <Text selectable muted>
              {String(p.payload.text)}
            </Text>
          ) : null}
          {p.error && (
            <>
              <Text style={{ color: colors.error }}>{p.error}</Text>
              <Text muted>
                版本冲突时，先放弃这次未同步操作，再查看最新内容并重新操作。
              </Text>
              <Button
                label="重试原操作"
                secondary
                onPress={() => void s.retry(p.id)}
              />
            </>
          )}
          {p.action !== "conversation.create" && (
            <Button
              label="放弃这次未同步操作"
              secondary
              onPress={() =>
                Alert.alert(
                  "放弃未同步操作？",
                  "已经保存到服务端的内容不会被删除。",
                  [
                    { text: "保留", style: "cancel" },
                    {
                      text: "放弃",
                      style: "destructive",
                      onPress: () =>
                        void s
                          .discard(p.id)
                          .catch((e) => Alert.alert("操作失败", String(e))),
                    },
                  ],
                )
              }
            />
          )}
        </View>
      ))}
    </ScrollView>
  );
}
