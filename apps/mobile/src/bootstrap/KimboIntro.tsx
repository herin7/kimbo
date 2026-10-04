import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeOut, ReduceMotion } from "react-native-reanimated";

import { Text, useKimboTheme } from "@/design-system";

const INTRO_MS = 700;

/**
 * Holds the native splash's "Kimbo" wordmark for a beat after JS is ready, then fades into the app.
 * Must match the splash artwork (Manrope Bold 44, brand coral, centred) so the handoff is invisible.
 */
export function KimboIntro({ onDone }: { onDone: () => void }) {
  const { colors, motion } = useKimboTheme();

  useEffect(() => {
    const timer = setTimeout(onDone, INTRO_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <Animated.View
      accessibilityLabel="Kimbo"
      exiting={FadeOut.duration(motion.duration.slow).reduceMotion(ReduceMotion.System)}
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.wordmark, { color: colors.brand }]}>Kimbo</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", zIndex: 200 },
  // ponytail: fixed to the splash artwork rather than the display token, which could change independently.
  wordmark: { fontFamily: "Manrope_700Bold", fontSize: 44, includeFontPadding: false, letterSpacing: 0 },
});
