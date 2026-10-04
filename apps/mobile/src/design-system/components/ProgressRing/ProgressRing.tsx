import { useEffect, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { useKimboTheme } from "../../theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps extends PropsWithChildren {
  accessibilityLabel: string;
  color?: string;
  /** Fill from zero when first shown. Off to appear already filled (e.g. returning to a tab). */
  animateOnMount?: boolean;
  /** Fill duration in ms; defaults to the theme slow duration. */
  duration?: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  value: number;
}

export function ProgressRing({
  accessibilityLabel,
  animateOnMount = true,
  children,
  color,
  duration,
  size = 184,
  strokeWidth = 8,
  trackColor,
  value,
}: ProgressRingProps) {
  const { colors, motion } = useKimboTheme();
  const reducedMotion = useReducedMotion();
  const normalizedValue = Math.min(1, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * 2 * radius;
  const progress = useSharedValue(reducedMotion || !animateOnMount ? normalizedValue : 0);

  useEffect(() => {
    progress.set(
      reducedMotion
        ? normalizedValue
        : withTiming(normalizedValue, {
            duration: duration ?? motion.duration.slow,
            easing: motion.easing.standard,
          }),
    );
  }, [duration, motion.duration.slow, motion.easing.standard, normalizedValue, progress, reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
  }));

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(normalizedValue * 100) }}
      style={[styles.container, { height: size, width: size }]}
    >
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={trackColor ?? colors.surfaceInteractive}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          animatedProps={animatedProps}
          cx={size / 2}
          cy={size / 2}
          fill="none"
          origin={`${size / 2}, ${size / 2}`}
          r={radius}
          rotation={-90}
          // A gradient url() stroke does not render on an animated circle in react-native-svg.
          stroke={color ?? colors.brand}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
      </Svg>
      <View pointerEvents="none" style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
