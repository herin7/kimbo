import { StyleSheet, View } from "react-native";

import { useKimboTheme } from "../../theme";
import { Text } from "../Text";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const { colors, radius, spacing } = useKimboTheme();
  const foreground = {
    neutral: colors.textSecondary,
    success: colors.success,
    warning: colors.warning,
  }[tone];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      <Text variant="caption" style={{ color: foreground }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    borderWidth: 1,
  },
});
