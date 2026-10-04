import * as Haptics from "expo-haptics";
import { Radio, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button, Card, Text, useKimboTheme } from "@/design-system";
import { KimboCompanion } from "@/features/kimbo/components/KimboCompanion";
import { kimboMode, useKimboMode } from "@/features/kimbo/kimbo-mode.store";
import { useKimboDay } from "@/features/kimbo/hooks/useKimboDay";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LiveIslandControl() {
  const { colors, motion, radius, spacing } = useKimboTheme();
  const { hasPermission, isAvailable, isEnabled } = useKimboMode();
  const day = useKimboDay();
  const [isRequesting, setIsRequesting] = useState(false);
  const activation = useSharedValue(isEnabled ? 1 : 0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    activation.value = withSpring(isEnabled ? 1 : 0, {
      ...motion.spring.soft,
      reduceMotion: ReduceMotion.System,
    });
    if (isEnabled) {
      shimmer.value = 0;
      shimmer.value = withTiming(1, {
        duration: motion.duration.slow * 2,
        easing: motion.easing.standard,
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [activation, isEnabled, motion, shimmer]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: activation.value * (0.18 + shimmer.value * 0.18),
    transform: [{ scale: 0.88 + activation.value * 0.22 }],
  }));
  const islandStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(activation.value, [0, 1], [4, 0], Extrapolation.CLAMP) },
      { scale: interpolate(activation.value, [0, 1], [0.94, 1], Extrapolation.CLAMP) },
    ],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(activation.value, [0, 1], [3, 27], Extrapolation.CLAMP) }],
  }));

  if (!isAvailable) return null;

  const requestPermission = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    kimboMode.setEnabled(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (await kimboMode.requestPermission()) {
        kimboMode.setEnabled(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleToggle = async () => {
    const nextEnabled = !isEnabled;
    kimboMode.setEnabled(nextEnabled);
    if (!nextEnabled) {
      await Haptics.selectionAsync();
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!hasPermission) await requestPermission();
  };

  const isReady = isEnabled && hasPermission;

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isReady ? colors.brand : colors.border,
          borderRadius: radius.xl,
          gap: spacing.lg,
        },
      ]}
      variant="outlined"
    >
      <View style={styles.previewStage}>
        <Animated.View
          pointerEvents="none"
          style={[styles.halo, haloStyle, { backgroundColor: colors.brandGlow, borderRadius: radius.pill }]}
        />
        <Animated.View
          style={[
            styles.previewIsland,
            islandStyle,
            {
              backgroundColor: colors.activityIslandBackground,
              borderColor: isReady ? colors.activityIslandAccent : colors.activityIslandBorder,
              borderRadius: radius.pill,
            },
          ]}
        >
          <View style={[styles.liveDot, { backgroundColor: isReady ? colors.activityIslandAccent : colors.activityIslandSecondary }]} />
          <View style={styles.previewCopy}>
            <Text style={[styles.previewEyebrow, { color: colors.activityIslandPrimary }]} variant="caption">KIMBO</Text>
            <Text style={[styles.previewLabel, { color: colors.activityIslandPrimary }]} variant="bodySmall">Island</Text>
          </View>
          {isReady ? (
            <KimboCompanion framed={false} mood={day?.reaction.mood ?? "neutral"} size={36} />
          ) : (
            <Sparkles color={colors.activityIslandSecondary} size={20} strokeWidth={2.1} />
          )}
        </Animated.View>
      </View>

      <View style={styles.settingRow}>
        <View style={[styles.settingIcon, { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg }]}>
          <Radio color={isReady ? colors.brand : colors.textMuted} size={23} strokeWidth={2.1} />
        </View>
        <View style={[styles.copy, { gap: spacing.xs }]}>
          <Text variant="heading">Kimbo Mode</Text>
          <Text color="secondary" variant="bodySmall">
            {isReady
              ? "One Kimbo island stays available across your phone."
              : isEnabled
                ? "Allow display access to bring the island to life."
                : "Off. Tracking still works in Kimbo and its notification."}
          </Text>
        </View>
        <AnimatedPressable
          accessibilityLabel={`Turn Kimbo Mode ${isEnabled ? "off" : "on"}`}
          accessibilityRole="switch"
          accessibilityState={{ checked: isEnabled }}
          onPress={() => void handleToggle()}
          style={[
            styles.switchTrack,
            {
              backgroundColor: isEnabled ? colors.brand : colors.surfaceInteractive,
              borderColor: isEnabled ? colors.brandPressed : colors.border,
              borderRadius: radius.pill,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.switchKnob,
              knobStyle,
              { backgroundColor: isEnabled ? colors.textInverse : colors.textMuted, borderRadius: radius.pill },
            ]}
          />
        </AnimatedPressable>
      </View>

      {isEnabled && !hasPermission ? (
        <View style={{ gap: spacing.sm }}>
          <Button loading={isRequesting} onPress={() => void requestPermission()}>
            Open display settings
          </Button>
          <Text color="muted" style={styles.note} variant="caption">
            Android controls this special access. Kimbo will keep this reminder visible until it is allowed or you switch the island off.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  previewStage: {
    alignItems: "center",
    height: 82,
    justifyContent: "center",
  },
  halo: {
    height: 94,
    position: "absolute",
    width: 238,
  },
  previewIsland: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    height: 58,
    paddingHorizontal: 18,
    width: 206,
  },
  liveDot: {
    borderRadius: 99,
    height: 7,
    width: 7,
  },
  previewCopy: {
    flex: 1,
    marginLeft: 10,
  },
  previewEyebrow: {
    fontFamily: "Manrope_700Bold",
    letterSpacing: 1.2,
    opacity: 0.72,
  },
  previewLabel: {
    fontFamily: "Manrope_600SemiBold",
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  settingIcon: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  copy: {
    flex: 1,
    marginHorizontal: 12,
  },
  switchTrack: {
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: "center",
    width: 58,
  },
  switchKnob: {
    height: 26,
    shadowColor: "#000000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    width: 26,
  },
  note: {
    lineHeight: 17,
    textAlign: "center",
  },
});
