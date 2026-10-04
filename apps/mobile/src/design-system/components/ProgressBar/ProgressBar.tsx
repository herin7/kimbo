import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useKimboTheme } from "../../theme";
import { SurfaceGradient } from "../SurfaceGradient";

export interface ProgressBarProps {
  value: number;
  color?: string;
  /** Two-stop fill gradient; overrides color. */
  gradient?: readonly [string, string];
  /** Fill from zero when first shown. */
  animateOnMount?: boolean;
  duration?: number;
  height?: number;
  trackColor?: string;
  accessibilityLabel: string;
  style?: ViewStyle;
}

export function ProgressBar({
  value,
  color,
  gradient,
  animateOnMount = true,
  duration,
  height,
  trackColor,
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const { colors, motion, radius, sizing } = useKimboTheme();
  const reducedMotion = useReducedMotion();
  const normalizedValue = Math.min(1, Math.max(0, value));
  const progress = useSharedValue(reducedMotion || !animateOnMount ? normalizedValue : 0);

  useEffect(() => {
    progress.value = reducedMotion
      ? normalizedValue
      : withTiming(normalizedValue, {
          duration: duration ?? motion.duration.slow,
          easing: motion.easing.standard,
        });
  }, [duration, motion.duration.slow, motion.easing.standard, normalizedValue, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalizedValue * 100) }}
      style={[
        styles.track,
        {
          backgroundColor: trackColor ?? colors.border,
          borderRadius: radius.pill,
          height: height ?? sizing.progressBar,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            // Solid start colour underneath, so the bar is never empty if the SVG wash is late.
            backgroundColor: gradient ? gradient[0] : color ?? colors.brand,
            borderRadius: radius.pill,
          },
          animatedStyle,
        ]}
      >
        {gradient ? <SurfaceGradient from={gradient[0]} to={gradient[1]} /> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
    width: "100%",
  },
  fill: {
    height: "100%",
    overflow: "hidden",
    transformOrigin: "left center",
    width: "100%",
  },
});
