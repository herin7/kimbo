import type { PropsWithChildren } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useKimboTheme } from "../../theme";

export interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
}

export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
  style,
  ...props
}: PropsWithChildren<ScreenProps>) {
  const { colors, sizing, spacing } = useKimboTheme();
  const contentStyle = [
    styles.content,
    {
      gap: spacing.xl,
      maxWidth: sizing.contentMaxWidth,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    contentContainerStyle,
  ];

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: colors.background }, style]}
    >
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          {...props}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    width: "100%",
  },
});
