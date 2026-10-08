import { ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { guideSections } from "@rho/shared/guide";
import { Text, Button, pageStyle } from "../../components/ui";
import { colors, space } from "../../theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GuideTopic() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const section = guideSections.find((s) => s.id === topic);
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={pageStyle}>
        <Stack.Screen options={{ title: section?.title ?? "试用指南" }} />
        {!section ? (
          <Text>没有找到这部分指南，请返回目录重新打开。</Text>
        ) : (
          <>
            {section.entries.map((entry) => (
              <View
                key={entry.title}
                style={{
                  gap: space.md,
                  paddingBottom: space.page,
                  borderBottomWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <Text title accessibilityRole="header">
                  {entry.title}
                </Text>
                {entry.paragraphs.map((paragraph) => (
                  <Text selectable key={paragraph}>
                    {paragraph}
                  </Text>
                ))}
                {"expected" in entry && (
                  <Text selectable muted>
                    预期结果：{entry.expected}
                  </Text>
                )}
              </View>
            ))}
            {section.id === "connection" && (
              <Button
                label="打开连接与提醒"
                onPress={() => router.push("/settings")}
              />
            )}
            {section.id === "verification" && (
              <Button
                label="查看同步状态"
                secondary
                onPress={() => router.push("/sync")}
              />
            )}
          </>
        )}
        <Button
          label="返回指南目录"
          secondary
          onPress={() => router.dismissTo("/guide")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
