import { Camera, ChevronRight, Keyboard, Mic2, ShieldCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";

import { Screen, Text, useKimboTheme } from "@/design-system";

const methods = [
  {
    title: "Speak it",
    description: "Best for a full meal with several items.",
    route: "/meal/voice" as const,
    Icon: Mic2,
    tone: "brand" as const,
  },
  {
    title: "Scan it",
    description: "Photograph the whole plate or choose an image.",
    route: "/meal/camera" as const,
    Icon: Camera,
    tone: "steps" as const,
  },
  {
    title: "Type it",
    description: "Enter a food and nutrition values yourself.",
    route: "/meal/manual" as const,
    Icon: Keyboard,
    tone: "protein" as const,
  },
] as const;

export function MealCaptureScreen() {
  const router = useRouter();
  const { colors, motion, radius, spacing } = useKimboTheme();

  return (
    <Screen contentContainerStyle={{ paddingTop: spacing.sm }}>
      <View style={{ gap: spacing.sm }}>
        <Text color="brand" variant="caption">CAPTURE A MEAL</Text>
        <Text variant="title">Fast in. Accurate out.</Text>
        <Text color="secondary">Choose the quickest input. Kimbo never saves an estimate until you approve it.</Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {methods.map((method, index) => {
          const color = colors[method.tone];
          return (
            <Animated.View
              entering={FadeInDown.delay(index * 55).duration(motion.duration.normal).easing(motion.easing.standard).reduceMotion(ReduceMotion.System)}
              key={method.title}
            >
              <CaptureMethod
                description={method.description}
                icon={<method.Icon color={color} size={27} strokeWidth={2.1} />}
                onPress={() => router.push(method.route)}
                title={method.title}
              />
            </Animated.View>
          );
        })}
      </View>

      <View style={[styles.trust, { backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, gap: spacing.md, padding: spacing.lg }]}>
        <ShieldCheck color={colors.textMuted} size={21} strokeWidth={2} />
        <Text color="secondary" style={styles.trustCopy} variant="bodySmall">
          Portions stay editable. Low-confidence results are clearly marked.
        </Text>
      </View>
    </Screen>
  );
}

function CaptureMethod({ description, icon, onPress, title }: { description: string; icon: ReactNode; onPress: () => void; title: string }) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.method,
        {
          backgroundColor: pressed ? colors.surfaceInteractive : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing.lg,
        },
      ]}
    >
      <View style={[styles.methodIcon, { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg }]}>{icon}</View>
      <View style={[styles.methodCopy, { gap: spacing.xs }]}>
        <Text variant="heading">{title}</Text>
        <Text color="secondary" variant="bodySmall">{description}</Text>
      </View>
      <ChevronRight color={colors.textMuted} size={22} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  method: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 88 },
  methodIcon: { alignItems: "center", height: 54, justifyContent: "center", width: 54 },
  methodCopy: { flex: 1, marginHorizontal: 14 },
  trust: { alignItems: "center", flexDirection: "row" },
  trustCopy: { flex: 1 },
});
