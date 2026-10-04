import {
  Text as NativeText,
  type TextProps as NativeTextProps,
  type TextStyle,
} from "react-native";

import { useKimboTheme } from "../../theme";
import type { TypographyVariant } from "../../tokens";

type TextColor =
  | "primary"
  | "secondary"
  | "muted"
  | "inverse"
  | "brand"
  | "steps"
  | "calories"
  | "protein"
  | "success"
  | "danger";

export interface TextProps extends NativeTextProps {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: TextStyle["textAlign"];
}

export function Text({
  variant = "body",
  color = "primary",
  align,
  style,
  ...props
}: TextProps) {
  const { colors, typography } = useKimboTheme();
  const textColor = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    inverse: colors.textInverse,
    brand: colors.brand,
    steps: colors.steps,
    calories: colors.calories,
    protein: colors.protein,
    success: colors.success,
    danger: colors.danger,
  }[color];

  return (
    <NativeText
      style={[typography[variant], { color: textColor, textAlign: align }, style]}
      {...props}
    />
  );
}
