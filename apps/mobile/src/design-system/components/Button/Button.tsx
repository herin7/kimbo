import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useKimboTheme } from "../../theme";
import { Text } from "../Text";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ButtonProps
  extends Omit<PressableProps, "children" | "style"> {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...props
}: ButtonProps) {
  const { colors, radius, sizing, spacing } = useKimboTheme();
  const isDisabled = disabled || loading;
  const press = useSharedValue(0);
  const palette = {
    primary: { background: colors.brand, foreground: colors.textInverse },
    secondary: { background: colors.brandSoft, foreground: colors.brand },
    ghost: { background: "transparent", foreground: colors.textPrimary },
    danger: { background: colors.danger, foreground: colors.textInverse },
  }[variant];
  const padding = {
    sm: { horizontal: spacing.md, vertical: spacing.sm },
    md: { horizontal: spacing.lg, vertical: spacing.md },
    lg: { horizontal: spacing.xl, vertical: spacing.lg },
  }[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.get() * 0.025 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
      disabled={isDisabled}
      onPressIn={(event) => {
        press.set(withSpring(1, { duration: 110, dampingRatio: 1, reduceMotion: ReduceMotion.System }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.set(withSpring(0, { duration: 180, dampingRatio: 0.86, reduceMotion: ReduceMotion.System }));
        onPressOut?.(event);
      }}
      style={[
        styles.base,
        {
          minHeight: sizing.touchTarget,
          paddingHorizontal: padding.horizontal,
          paddingVertical: padding.vertical,
          borderRadius: radius.md,
          backgroundColor: palette.background,
          opacity: isDisabled ? 0.42 : 1,
        },
        animatedStyle,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={palette.foreground} />
      ) : (
        <View style={[styles.content, { gap: spacing.sm }]}>
          {leftIcon}
          <Text
            variant="body"
            style={[styles.label, { color: palette.foreground }]}
          >
            {children}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Manrope_700Bold",
    textAlign: "center",
  },
});
