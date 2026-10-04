import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useKimboTheme } from "@/design-system";

export function ScanLine() {
  const { colors, motion } = useKimboTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!reduceMotion) progress.value = withRepeat(withTiming(1, { duration: motion.duration.slow * 6 }), -1, false);
    return () => cancelAnimation(progress);
  }, [motion.duration.slow, progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: progress.value * 236 }] }));
  return <Animated.View accessible={false} style={[styles.line, animatedStyle, { backgroundColor: colors.brand }]} />;
}

const styles = StyleSheet.create({ line: { height: 2, left: 0, opacity: 0.7, position: "absolute", right: 0, top: 0 } });
