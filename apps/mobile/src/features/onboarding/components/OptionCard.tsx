import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, ReduceMotion } from "react-native-reanimated";

import { SurfaceGradient, Text, useKimboTheme } from "@/design-system";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

/** A single-choice card: icon, title, one line of context, and a clear selected state. */
export function OptionCard({ description, icon: Icon, onSelect, selected, title }: OptionCardProps) {
  const { colors, radius, spacing } = useKimboTheme();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.get() * 0.025 }] }));

  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      onPressIn={() => pressed.set(withSpring(1, { duration: 100, dampingRatio: 1, reduceMotion: ReduceMotion.System }))}
      onPressOut={() => pressed.set(withSpring(0, { duration: 200, dampingRatio: 0.8, reduceMotion: ReduceMotion.System }))}
      style={[
        styles.card,
        { borderColor: selected ? colors.brand : colors.border, borderRadius: radius.lg, gap: spacing.md, padding: spacing.lg },
        animatedStyle,
      ]}
    >
      <SurfaceGradient
        borderRadius={radius.lg}
        from={selected ? colors.brandSoft : colors.surfaceElevated}
        to={selected ? colors.surface : colors.surface}
      />
      <View style={[styles.icon, { backgroundColor: selected ? colors.brand : colors.surfaceSunken, borderRadius: radius.md }]}>
        <Icon color={selected ? colors.textInverse : colors.textSecondary} size={22} strokeWidth={2.1} />
      </View>
      <View style={[styles.copy, { gap: 2 }]}>
        <Text style={styles.title}>{title}</Text>
        <Text color="secondary" variant="bodySmall">{description}</Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.brand : colors.border }]}>
        {selected ? <View style={[styles.radioFill, { backgroundColor: colors.brand }]} /> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", borderCurve: "continuous", borderWidth: 1, flexDirection: "row", overflow: "hidden" },
  icon: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  copy: { flex: 1 },
  title: { fontFamily: "Manrope_700Bold" },
  radio: { alignItems: "center", borderRadius: 99, borderWidth: 2, height: 22, justifyContent: "center", width: 22 },
  radioFill: { borderRadius: 99, height: 10, width: 10 },
});
