import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { useKimboTheme } from "../../theme";

export interface CardProps extends ViewProps {
  variant?: "filled" | "outlined";
}

export function Card({
  children,
  variant = "filled",
  style,
  ...props
}: PropsWithChildren<CardProps>) {
  const { colors, radius, shadows, spacing } = useKimboTheme();

  return (
    <View
      style={[
        styles.base,
        shadows.card,
        {
          backgroundColor: colors.surface,
          borderColor: variant === "outlined" ? colors.border : "transparent",
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderCurve: "continuous",
    borderWidth: 1,
  },
});
