import { useState } from "react";
import {
  ScrollView,
  View,
  Alert,
  PermissionsAndroid,
  Platform,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { Text, Button, Input, pageStyle } from "../components/ui";
import { colors } from "../theme";
import { Reminders } from "../../modules/rho-reminders";
import { SafeAreaView } from "react-native-safe-area-context";
export default function Settings() {
  const s = useStore(),
    [url, setUrl] = useState(s.connection?.url ?? "https://rho.sh.corgi.plus"),
    [token, setToken] = useState(s.connection?.token ?? ""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setSaving(true);
    setError("");
    try {
      await s.configure({ url, token });
      s.audit("connection.saved");
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function permissions() {
    try {
      if (Platform.OS === "android" && Number(Platform.Version) >= 33)
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      await Reminders?.openSettings();
    } catch (e) {
      Alert.alert("无法打开设置", String(e));
    }
  }
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={pageStyle}
        keyboardShouldPersistTaps="handled"
      >
        <Button
          label="试用指南与资料"
          secondary
          onPress={() => router.push("/guide")}
        />
        <Button
          label="发布版本与下载"
          secondary
          onPress={() => router.push("/releases")}
        />
        <Button
          label="LLM 模型"
          secondary
          onPress={() => router.push("/models")}
        />
        <Text title>连接你的 rho</Text>
        <Text muted>
          连接一次后自动保存。服务端负责对话，手机保留离线记录和提醒。
        </Text>
        <Text>服务地址</Text>
        <Input
          accessibilityLabel="服务地址"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text>访问令牌</Text>
        <Input
          accessibilityLabel="访问令牌"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="输入部署时生成的访问令牌"
        />
        {error ? (
          <Text selectable style={{ color: colors.error }}>
            {error}
          </Text>
        ) : null}
        <Button
          label="验证并保存连接"
          loading={saving}
          onPress={() => void save()}
        />
        <View style={{ height: 8 }} />
        <Text title>手机提醒</Text>
        <Text muted>
          {!Reminders
            ? "本构建未包含本地提醒模块，请安装完整 APK。"
            : s.reminders?.notificationPermission
              ? "通知已开启。已同步的提醒在断网时也能触发，系统可能显示下一次闹钟标志。"
              : "请开启通知，才能在锁屏时收到提醒。"}
        </Text>
        {s.reminders && !s.reminders.exactAlarmPermission && (
          <Text muted>请开启精确提醒权限，减少系统延迟。</Text>
        )}
        <Button
          label="打开系统提醒设置"
          secondary
          disabled={!Reminders}
          onPress={() => void permissions()}
        />
        <Button
          label="查看提醒记录"
          secondary
          onPress={() => router.push("/reminders")}
        />
        <Button
          label="查看同步状态"
          secondary
          onPress={() => router.push("/sync")}
        />
        <View style={{ height: 8 }} />
        <Text muted style={{ fontSize: 13 }}>
          rho · 第一个 demo{"\n"}本软件使用 MiSans 字体。
        </Text>
        <Button
          label="MiSans 字体许可协议"
          secondary
          onPress={() =>
            void Linking.openURL("https://hyperos.mi.com/font/zh/download/")
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
