import React from "react";
import {
  Text as RNText,
  TextInput,
  Pressable,
  View,
  ActivityIndicator,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { router } from "expo-router";
import { colors, font, radius, space } from "../theme";
import { useStore } from "../lib/store";
export function Text({
  muted,
  title,
  style,
  ...props
}: TextProps & { muted?: boolean; title?: boolean }) {
  return (
    <RNText
      {...props}
      style={[
        {
          color: muted ? colors.muted : colors.text,
          fontFamily: title ? font.medium : font.regular,
          fontSize: title ? 20 : 16,
          lineHeight: title ? 29 : 25,
        },
        style,
      ]}
    />
  );
}
export function Button({
  label,
  onPress,
  secondary,
  disabled,
  loading,
  selected,
}: {
  label: string;
  onPress(): void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
}) {
  const { audit } = useStore();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
        selected,
      }}
      disabled={disabled || loading}
      onPress={() => {
        audit("button.press", label);
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? colors.raised : colors.accent,
        opacity: disabled || pressed ? 0.55 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text
          style={{
            color: secondary ? colors.accent : colors.onAccent,
            fontFamily: font.medium,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      {...props}
      style={[
        {
          minHeight: 52,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 12,
          color: colors.text,
          backgroundColor: colors.surface,
          padding: 14,
          fontFamily: font.regular,
          fontSize: 16,
        },
        props.style,
      ]}
    />
  );
}
export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius,
        padding: space.page,
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ paddingVertical: 36, gap: 12 }}>
      <Text title>{title}</Text>
      <Text muted>{body}</Text>
    </View>
  );
}
export function Status() {
  const s = useStore();
  if (!s.ready)
    return <ActivityIndicator color={colors.accent} style={{ padding: 20 }} />;
  if (!s.connection)
    return (
      <View style={{ gap: 12, marginBottom: 16 }}>
        <Text muted>先连接你的服务，开始记录日常。</Text>
        <Button label="连接 rho" onPress={() => router.push("/settings")} />
      </View>
    );
  if (s.error || s.pending.some((p) => p.action !== "audit"))
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/sync")}
        style={{ paddingVertical: 12 }}
      >
        <Text
          style={{ color: s.error ? colors.error : colors.muted, fontSize: 13 }}
        >
          {s.error ??
            `有 ${s.pending.filter((p) => p.action !== "audit").length} 项操作等待同步`}{" "}
          · 查看
        </Text>
      </Pressable>
    );
  return null;
}
export const pageStyle = {
  padding: space.page,
  paddingBottom: 36,
  gap: space.md,
};
export function date(value: string | number) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
