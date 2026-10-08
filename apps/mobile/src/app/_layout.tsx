import { useFonts } from "expo-font";
import { ActivityIndicator } from "react-native";
import { Stack, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { Provider, useStore } from "../lib/store";
import { colors, font } from "../theme";
function NavigationAudit() {
  const path = usePathname(),
    s = useStore(),
    latest = useRef(s.audit);
  latest.current = s.audit;
  useEffect(() => {
    if (s.ready) latest.current("page.open", path);
  }, [path, s.ready]);
  return null;
}
export default function Root() {
  const [loaded, error] = useFonts({
    MiSans: require("../../assets/fonts/MiSans-Regular.ttf"),
    MiSansMedium: require("../../assets/fonts/MiSans-Medium.ttf"),
  });
  if (!loaded && !error)
    return (
      <ActivityIndicator
        color={colors.accent}
        style={{ flex: 1, backgroundColor: colors.background }}
      />
    );
  return (
    <Provider>
      <NavigationAudit />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: font.medium },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: "设置" }} />
        <Stack.Screen name="models" options={{ title: "LLM 模型" }} />
        <Stack.Screen name="releases" options={{ title: "发布版本" }} />
        <Stack.Screen name="guide/index" options={{ title: "试用指南" }} />
        <Stack.Screen name="guide/[topic]" options={{ title: "试用指南" }} />
        <Stack.Screen name="chat/[id]" options={{ title: "对话" }} />
        <Stack.Screen name="item/[id]" options={{ title: "记录详情" }} />
        <Stack.Screen name="sync" options={{ title: "同步状态" }} />
        <Stack.Screen name="reminders" options={{ title: "提醒记录" }} />
      </Stack>
    </Provider>
  );
}
