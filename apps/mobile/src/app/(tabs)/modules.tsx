import { useState } from "react";
import { FlatList, View, Pressable } from "react-native";
import { router } from "expo-router";
import { moduleNames, type ModuleId } from "@rho/shared";
import { useEntities, useStore } from "../../lib/store";
import {
  Text,
  Button,
  Input,
  Empty,
  Status,
  pageStyle,
  date,
} from "../../components/ui";
import { colors } from "../../theme";
export default function Modules() {
  const [module, setModule] = useState<ModuleId>("health"),
    [search, setSearch] = useState("");
  const s = useStore();
  const rows = useEntities("item")
    .filter(
      (i) =>
        i.data.module === module &&
        JSON.stringify(i.data).toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.data.occurredAt.localeCompare(a.data.occurredAt));
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={pageStyle}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Status />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(moduleNames) as ModuleId[]).map((id) => (
              <Button
                key={id}
                label={moduleNames[id]}
                secondary={module !== id}
                selected={module === id}
                onPress={() => {
                  setModule(id);
                  s.audit("module.open", id);
                }}
              />
            ))}
          </View>
          <Input
            accessibilityLabel="搜索记录"
            placeholder="搜索已保存的记录"
            value={search}
            onChangeText={setSearch}
          />
          <Text muted>
            {module === "health"
              ? "身体的变化、睡眠和日常习惯，都可以通过对话记录。"
              : module === "investment"
                ? "留住想法，也留住当时的理由。"
                : "已完成和还在进行的事，都保留在这里。"}
          </Text>
        </View>
      }
      ListEmptyComponent={
        s.ready ? (
          <Empty
            title={search ? "没有找到相关记录" : "这里还没有记录"}
            body={
              search
                ? "换个关键词试试。"
                : "在任一对话中告诉 rho，它会帮你整理并保存。"
            }
          />
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            s.audit("item.open", item.id);
            router.push({ pathname: "/item/[id]", params: { id: item.id } });
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
            {item.data.content}
          </Text>
          <Text muted style={{ fontSize: 13 }}>
            {date(item.data.occurredAt)} · {item.data.category}
            {item.data.kind === "task"
              ? ` · ${item.data.status === "completed" ? "已完成" : "进行中"}`
              : ""}
          </Text>
        </Pressable>
      )}
    />
  );
}
