import { Tabs, router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font } from "../../theme";
import { useStore } from "../../lib/store";
export default function Layout() {
  const { audit } = useStore();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return (
    <Tabs
      screenListeners={({ route }) => ({
        tabPress: () => audit("tab.open", route.name),
      })}
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: font.medium },
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.line,
          height: 64 + insets.bottom + Math.max(0, fontScale - 1) * 24,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="连接与提醒设置"
            onPress={() => router.push("/settings")}
            style={{ padding: 16 }}
          >
            <MaterialIcons name="tune" color={colors.muted} size={24} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: "对话",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="chat-bubble-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="modules"
        options={{
          title: "模块",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="view-agenda" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
