import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import {
  Stack,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ModelOptions } from "@rho/shared";
import { useEntities, useStore } from "../lib/store";
import { Button, Input, Text } from "../components/ui";
import { colors, space } from "../theme";
export default function Models() {
  const { conversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();
  const s = useStore();
  const conversation = useEntities("conversation").find(
    (c) => c.id === conversationId,
  );
  const [options, setOptions] = useState<ModelOptions>();
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);
  const current = conversationId
    ? conversation?.data.modelId
    : options?.defaultModelId;
  const currentRef = useRef(current);
  currentRef.current = current;
  const load = useCallback(async () => {
    const attempt = ++generation.current;
    setLoading(true);
    setError("");
    try {
      if (conversationId) await s.sync();
      const result = await s.loadModels();
      if (attempt !== generation.current) return;
      setOptions(result);
      setSelected(
        (previous) =>
          previous ||
          (conversationId ? currentRef.current : result.defaultModelId) ||
          "",
      );
    } catch (e) {
      if (attempt === generation.current) setError((e as Error).message);
    } finally {
      if (attempt === generation.current) setLoading(false);
    }
  }, [s.loadModels, s.sync, conversationId]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        generation.current++;
      };
    }, [load]),
  );
  async function save() {
    if (!options || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      if (conversationId) {
        if (!conversation?.version)
          throw new Error("此对话尚未同步，请联网同步后重试");
        await s.saveConversationModel(
          conversationId,
          selected,
          conversation.version,
        );
      } else {
        await s.saveDefaultModel(selected, options.version);
        setOptions({
          ...options,
          defaultModelId: selected,
          version: options.version + 1,
        });
      }
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const models =
    options?.models.filter((m) =>
      m.toLowerCase().includes(query.toLowerCase().trim()),
    ) ?? [];
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Stack.Screen
        options={{ title: conversationId ? "此对话的模型" : "新对话默认模型" }}
      />
      <FlatList
        data={models}
        keyExtractor={(m) => m}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.page, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 20 }}>
            <Text>
              {conversationId
                ? "切换后，下一条消息使用所选模型。正在进行的回复保持原模型，对话记录继续保留。"
                : "只影响之后创建的新对话。已有对话可以点击顶部模型名称单独设置。"}
            </Text>
            <Text muted selectable>
              当前：{current ?? (conversationId ? "等待对话同步" : "正在获取…")}
            </Text>
            {current && options && !options.models.includes(current) && (
              <Text style={{ color: colors.error }}>
                当前模型已不在可用列表中，请选择其他模型。
              </Text>
            )}
            <Input
              accessibilityLabel="搜索模型"
              placeholder="搜索模型名称"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text muted>
                可用模型{options ? ` · ${options.models.length}` : ""}
              </Text>
              <Button
                label="刷新列表"
                secondary
                loading={loading}
                disabled={saving}
                onPress={() => void load()}
              />
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={{ color: colors.error }}>
                {error}
              </Text>
            ) : null}
            {!s.connection && (
              <Button
                label="连接 rho"
                onPress={() => router.push("/settings")}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text muted>
              {options
                ? query
                  ? "没有匹配的模型，试试其他名称。"
                  : "LiteLLM 暂无可用模型，请刷新重试。"
                : "模型列表尚未加载，请检查连接后重试。"}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={item}
            accessibilityState={{
              checked: selected === item,
              disabled: saving,
            }}
            disabled={saving}
            onPress={() => {
              setSelected(item);
              setSaved(false);
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              minHeight: 64,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <MaterialIcons
              name={
                selected === item
                  ? "radio-button-checked"
                  : "radio-button-unchecked"
              }
              color={selected === item ? colors.accent : colors.muted}
              size={24}
            />
            <Text
              style={{
                flex: 1,
                color: selected === item ? colors.accent : colors.text,
              }}
            >
              {item}
            </Text>
          </Pressable>
        )}
      />
      <View
        style={{
          padding: 16,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      >
        {saved && (
          <Text accessibilityLiveRegion="polite" muted>
            {conversationId
              ? "已保存，下一条消息使用此模型。"
              : "已保存，之后的新对话使用此模型。"}
          </Text>
        )}
        <Button
          label={conversationId ? "保存此对话模型" : "保存默认模型"}
          loading={saving}
          disabled={
            loading ||
            !options?.models.includes(selected) ||
            selected === current ||
            (!!conversationId && !conversation?.version)
          }
          onPress={() => void save()}
        />
      </View>
    </SafeAreaView>
  );
}
