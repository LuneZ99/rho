import { Alert, Linking, ScrollView, View } from "react-native";
import { router } from "expo-router";
import {
  demoUrl,
  guideIntro,
  guideSections,
  guideUrl,
} from "@rho/shared/guide";
import { Text, Button, pageStyle } from "../../components/ui";
import { colors, space } from "../../theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Guide() {
  async function openWeb() {
    try {
      await Linking.openURL(guideUrl);
    } catch {
      Alert.alert("未能打开浏览器", `联网后可以在浏览器打开：${guideUrl}`);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={pageStyle}>
        <Text muted>{guideIntro}</Text>
        {guideSections.map((section) => (
          <View
            key={section.id}
            style={{ gap: space.sm, paddingVertical: space.sm }}
          >
            <Button
              label={section.title}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/guide/[topic]",
                  params: { topic: section.id },
                })
              }
            />
            <Text muted>{section.summary}</Text>
          </View>
        ))}
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.line,
            paddingTop: space.page,
            gap: space.md,
          }}
        >
          <Text title>手机浏览器也能看</Text>
          <Text muted>
            网页提供同一份指南和新版安装包下载。你可以把链接加入浏览器书签。
          </Text>
          <Text selectable>{guideUrl}</Text>
          <Button label="打开网页版指南" onPress={() => void openWeb()} />
          <Text muted>服务地址</Text>
          <Text selectable>{demoUrl}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
