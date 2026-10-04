import type { KimboMood } from "@kimbo/domain";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";

import { SurfaceGradient, Text, useKimboTheme } from "@/design-system";

import { KimboCompanion } from "./KimboCompanion";

const moodLabel: Record<KimboMood, string> = {
  happy: "PLEASED",
  playful: "HYPED",
  neutral: "KIMBO",
  sad: "WORRIED",
  angry: "FIRED UP",
};

export interface KimboSaysProps {
  mood: KimboMood;
  line: string;
  size?: number;
}

/** Kimbo with a speech bubble. Tapping either part makes him react again. */
export function KimboSays({ line, mood, size = 72 }: KimboSaysProps) {
  const { colors, motion, radius, spacing } = useKimboTheme();
  const [pulse, setPulse] = useState(0);
  const tint: Record<KimboMood, string> = {
    happy: colors.success,
    playful: colors.brand,
    neutral: colors.textSecondary,
    sad: colors.protein,
    angry: colors.danger,
  };
  const react = () => setPulse((value) => value + 1);

  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      <KimboCompanion mood={mood} onPress={react} pulse={pulse} size={size} />
      <Pressable
        accessibilityHint="Kimbo reacts again"
        accessibilityLabel={`Kimbo says: ${line}`}
        accessibilityRole="button"
        onPress={react}
        style={[styles.bubble, { borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
      >
        <SurfaceGradient borderRadius={radius.lg} from={colors.surfaceElevated} to={colors.surface} />
        <View style={[styles.tail, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} />
        <View style={[styles.eyebrow, { gap: spacing.xs }]}>
          <View style={[styles.dot, { backgroundColor: tint[mood] }]} />
          <Text style={[styles.eyebrowText, { color: tint[mood] }]} variant="caption">{moodLabel[mood]}</Text>
        </View>
        <Animated.View entering={FadeIn.duration(motion.duration.slow).reduceMotion(ReduceMotion.System)} key={line}>
          <Text style={styles.line} variant="bodySmall">{line}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row" },
  bubble: { borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: 6 },
  tail: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    height: 12,
    left: -6,
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -6 }, { rotate: "45deg" }],
    width: 12,
  },
  eyebrow: { alignItems: "center", flexDirection: "row" },
  dot: { borderRadius: 99, height: 6, width: 6 },
  eyebrowText: { letterSpacing: 1.1 },
  line: { fontFamily: "Manrope_600SemiBold", fontSize: 15, lineHeight: 21 },
});
