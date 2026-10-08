import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  View,
} from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { demoUrl } from "@rho/shared/guide";
import {
  releaseCatalogSchema,
  releasePath,
  type Release,
} from "@rho/shared/releases";
import { Button, Empty, Text, pageStyle } from "../components/ui";
import { colors, radius, space } from "../theme";
import { useStore } from "../lib/store";

export default function Releases() {
  const { audit } = useStore();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const currentVersion =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version;
  const currentCode = Number(
    Constants.nativeBuildVersion ??
      Constants.expoConfig?.android?.versionCode ??
      0,
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setError("");
    fetch(`${demoUrl}/releases.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = releaseCatalogSchema.parse(await response.json());
        if (active)
          setReleases(result.sort((a, b) => b.versionCode - a.versionCode));
      })
      .catch(() => {
        if (active) setError("暂时无法获取发布版本，请检查网络后重试。");
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  async function download(release: Release) {
    audit("release.download", release.version);
    try {
      await Linking.openURL(`${demoUrl}${releasePath(release.version)}`);
    } catch {
      Alert.alert("无法打开下载", "请检查手机是否有可用的浏览器，再重试。");
    }
  }
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <FlatList
        data={releases}
        keyExtractor={(item) => item.version}
        contentContainerStyle={pageStyle}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Text title>当前版本 {currentVersion ?? "开发预览"}</Text>
            <Text muted>
              点击版本卡片，用浏览器下载
              APK，再从下载列表打开安装。首次安装可能需要允许浏览器安装应用。
            </Text>
            <Text muted>
              新版可覆盖更新。历史旧版可下载，但 Android
              通常不允许降级覆盖；请用备用设备测试旧版，卸载会清除手机本地数据及未同步内容。
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={{ color: colors.error }}>
                {error}
              </Text>
            ) : null}
            <Button
              label={error ? "重试获取版本" : "刷新发布列表"}
              secondary
              loading={loading}
              onPress={() => setAttempt((n) => n + 1)}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={colors.accent}
              accessibilityLabel="正在获取发布版本"
            />
          ) : !error ? (
            <Empty title="暂无发布版本" body="发布安装包后会出现在这里。" />
          ) : null
        }
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`下载 ${item.version}，${item.version.includes("-test.") ? "测试版" : "正式版"}`}
            onPress={() => void download(item)}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderRadius: radius,
              padding: space.page,
              gap: space.sm,
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <Text muted>
              {item.version.includes("-test.") ? "测试版" : "正式版"}
              {index === 0 ? " · 最新发布" : ""}
              {item.versionCode === currentCode
                ? " · 当前安装"
                : item.versionCode < currentCode
                  ? " · 历史旧版"
                  : ""}
            </Text>
            <Text title>{item.version}</Text>
            <Text muted>
              {new Date(item.publishedAt).toLocaleDateString("zh-CN")} ·{" "}
              {(item.size / 1024 / 1024).toFixed(1)} MB
            </Text>
            <Text>{item.notes}</Text>
            <Text style={{ color: colors.accent }}>下载 APK ↗</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
