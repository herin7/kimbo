import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Mic2 } from "lucide-react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useKimboTheme } from "@/design-system";

export function ListeningPulse() {
  const { colors, motion, radius } = useKimboTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!reduceMotion) pulse.value = withRepeat(withTiming(1, { duration: motion.duration.slow * 3 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [motion.duration.slow, pulse, reduceMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.2,
    transform: [{ scale: 0.92 + pulse.value * 0.2 }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.035 }],
  }));

  return (
    <View accessible={false} style={styles.stage}>
      <Animated.View
        style={[
          styles.halo,
          haloStyle,
          { backgroundColor: colors.brandGlow, borderColor: colors.brand, borderRadius: radius.pill },
        ]}
      />
      <View style={[styles.orbit, { borderColor: colors.border, borderRadius: radius.pill }]} />
      <Animated.View
        style={[
          styles.core,
          coreStyle,
          { backgroundColor: colors.brand, borderRadius: radius.pill },
        ]}
      >
        <Mic2 color={colors.textInverse} size={32} strokeWidth={2.2} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    height: 156,
    justifyContent: "center",
    width: 156,
  },
  halo: {
    borderWidth: 1,
    height: 152,
    position: "absolute",
    width: 152,
  },
  orbit: {
    borderWidth: 1,
    height: 118,
    opacity: 0.7,
    position: "absolute",
    width: 118,
  },
  core: {
    alignItems: "center",
    height: 82,
    justifyContent: "center",
    shadowColor: "#FF7657",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    width: 82,
  },
});
