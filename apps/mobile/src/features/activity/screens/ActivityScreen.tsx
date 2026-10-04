import { clampProgress } from "@kimbo/domain";
import { Footprints, ShieldCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Badge, Button, Card, PermissionFallback, ProgressRing, Screen, SurfaceGradient, Text, useKimboTheme } from "@/design-system";
import { KimboSays } from "@/features/kimbo/components/KimboSays";
import { useKimboDay } from "@/features/kimbo/hooks/useKimboDay";
import { useKimboMode } from "@/features/kimbo/kimbo-mode.store";
import { useOnboardingStatus } from "@/features/onboarding";

import { LiveIslandControl } from "../components/LiveIslandControl";
import { useActivityController } from "../hooks/useActivityController";
import { activityProvider, isUsingMockActivityProvider } from "../providers/activity-provider";
import { mockActivityProvider } from "../providers/MockActivityProvider";

type PermissionState = "checking" | "explanation" | "requesting" | "granted" | "denied";

export function ActivityScreen() {
  const router = useRouter();
  const { colors, motion, radius, spacing } = useKimboTheme();
  const { data: goal } = useOnboardingStatus();
  const controller = useActivityController(goal?.dailyStepTarget ?? 8_000);
  const day = useKimboDay();
  const { isActive: isIslandOn } = useKimboMode();
  const [permissionState, setPermissionState] = useState<PermissionState>("checking");
  const [now, setNow] = useState(0);

  useEffect(() => {
    void activityProvider.hasPermission().then((granted) => setPermissionState(granted ? "granted" : "explanation"));
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && permissionState === "requesting") {
        setTimeout(() => void activityProvider.hasPermission().then((granted) => setPermissionState(granted ? "granted" : "denied")), 300);
      }
    });
    return () => subscription.remove();
  }, [permissionState]);
  useEffect(() => {
    if (!controller.session) return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [controller.session]);

  if (!goal || controller.isLoading || permissionState === "checking") {
    return <Screen contentContainerStyle={{ paddingTop: spacing.huge + spacing.xxl }}><Text color="secondary">Preparing activity…</Text></Screen>;
  }

  if (controller.availability !== "available" && !isUsingMockActivityProvider) {
    return (
      <Screen contentContainerStyle={{ paddingBottom: spacing.huge * 2, paddingTop: spacing.huge + spacing.xxl }}>
        <Text variant="title">Step tracking is unavailable</Text>
        <Text color="secondary">{controller.availability === "updateRequired" ? "Health Connect needs an update before Kimbo can read steps." : "This device doesn’t support the required Health Connect capability."}</Text>
        <Text color="secondary">Meal logging and calorie tracking will continue working.</Text>
        <Button onPress={() => router.dismissTo("/today")}>Back to Today</Button>
      </Screen>
    );
  }

  if (permissionState === "explanation" || permissionState === "requesting") {
    const request = async () => {
      setPermissionState("requesting");
      try {
        const isGranted = await controller.requestPermission();
        setPermissionState(isGranted ? "granted" : "denied");
      } catch {
        setPermissionState("denied");
      }
    };
    return (
      <Screen contentContainerStyle={{ paddingBottom: spacing.huge * 2, paddingTop: spacing.huge + spacing.xxl }}>
        <View style={[styles.permissionIcon, { backgroundColor: colors.brandSoft, borderRadius: radius.xl }]}>
          <Footprints color={colors.brand} size={34} strokeWidth={1.9} />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title">Walk with live progress</Text>
          <Text color="secondary">Kimbo reads today’s steps while an activity runs, then keeps progress visible above other apps.</Text>
        </View>
        <Card style={[styles.permissionCard, { backgroundColor: colors.surfaceSunken }]}>
          <ShieldCheck color={colors.success} size={22} strokeWidth={2} />
          <Text color="secondary" style={styles.permissionCopy} variant="bodySmall">Health access is requested only here and can be revoked from Android settings.</Text>
        </Card>
        <Button loading={permissionState === "requesting"} onPress={request} size="lg">Continue to Health Connect</Button>
        <Button onPress={() => router.dismissTo("/today")} variant="ghost">Not now</Button>
      </Screen>
    );
  }

  if (permissionState === "denied") {
    return <Screen contentContainerStyle={{ paddingTop: spacing.huge + spacing.xxl }}><PermissionFallback description="Meal logging and calorie tracking will continue working without step access." onPrimaryPress={() => void Linking.openSettings()} onSecondaryPress={() => router.dismissTo("/today")} primaryLabel="Open settings" secondaryLabel="Back to Today" title="Step tracking is unavailable" /></Screen>;
  }

  const progress = clampProgress(controller.todaySteps, goal.dailyStepTarget);

  if (!controller.session) {
    const handleActivityStart = async () => {
      const didStart = await controller.start();
      if (!didStart) setPermissionState("denied");
    };
    return (
      <Screen contentContainerStyle={{ paddingBottom: spacing.huge * 2, paddingTop: spacing.huge + spacing.xxl }}>
        <View style={styles.headingRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text color="steps" variant="caption">READY WHEN YOU ARE</Text>
            <Text variant="title">Walking</Text>
          </View>
          {isUsingMockActivityProvider ? <Badge label="Demo data" tone="warning" /> : null}
        </View>

        <Animated.View entering={FadeInDown.duration(motion.duration.slow).easing(motion.easing.standard).reduceMotion(ReduceMotion.System)}>
          <Card style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}>
            <SurfaceGradient borderRadius={radius.xl} from={colors.movementWashFrom} to={colors.movementWashTo} />
            <SurfaceGradient borderRadius={radius.xl} center={{ x: 0.9, y: 0 }} from={colors.stepsGlow} to={colors.stepsGlowFade} variant="radial" />
            <ProgressRing accessibilityLabel="Daily step progress" color={colors.steps} size={198} strokeWidth={12} value={progress}>
              <Text variant="numericLarge">{controller.todaySteps.toLocaleString()}</Text>
              <Text color="secondary" variant="bodySmall">of {goal.dailyStepTarget.toLocaleString()} steps</Text>
            </ProgressRing>
            <Text color="secondary" style={styles.centerText}>{isIslandOn ? "Kimbo's island follows your walk across every app." : "Live progress stays in your notification while you walk."}</Text>
          </Card>
        </Animated.View>

        <Card variant="outlined">
          <KimboSays
            line={day?.reaction.line ?? (progress >= 1 ? "Goal's done, but a bonus lap never hurt anyone." : `${Math.max(0, goal.dailyStepTarget - controller.todaySteps).toLocaleString()} steps to go. Walk with me?`)}
            mood={day?.reaction.mood ?? (progress >= 1 ? "happy" : "playful")}
          />
        </Card>

        <LiveIslandControl />

        <Button loading={controller.isSaving} onPress={handleActivityStart} size="lg">Start walking</Button>
      </Screen>
    );
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(controller.session.startedAt).getTime()) / 1_000));
  const sessionSteps = Math.max(0, controller.todaySteps - controller.session.startingSteps);
  const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <Screen contentContainerStyle={{ paddingBottom: spacing.huge * 2, paddingTop: spacing.huge + spacing.xxl }}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text color="steps" variant="caption">ACTIVITY IN PROGRESS</Text>
          <Text variant="title">Walking</Text>
        </View>
        <LiveBadge />
      </View>

      <View style={[styles.activeHero, { borderColor: colors.border, borderRadius: radius.xl, gap: spacing.lg, padding: spacing.xl }]}>
        {/* Same wash + corner glow recipe as the Today hero, in green for a walk. */}
        <SurfaceGradient borderRadius={radius.xl} from={colors.movementWashFrom} to={colors.movementWashTo} />
        <SurfaceGradient borderRadius={radius.xl} center={{ x: 0.9, y: 0 }} from={colors.stepsGlow} to={colors.stepsGlowFade} variant="radial" />
        <View style={[styles.walkPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill, gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
          <Footprints color={colors.steps} size={16} strokeWidth={2.4} />
          <Text color="steps" variant="caption">LIVE WALK</Text>
        </View>
        <View style={styles.center}>
          <Text color="secondary" style={styles.eyebrow} variant="caption">ELAPSED</Text>
          <Text style={[styles.elapsed, { color: colors.textPrimary }]}>{elapsed}</Text>
        </View>
        <ProgressRing accessibilityLabel="Daily step progress" color={colors.steps} size={210} strokeWidth={14} value={progress}>
          <Text variant="numericLarge">{controller.todaySteps.toLocaleString()}</Text>
          <Text color="secondary" variant="bodySmall">of {goal.dailyStepTarget.toLocaleString()} steps</Text>
        </ProgressRing>
        <View style={[styles.metrics, { gap: spacing.sm }]}>
          <Metric label="this walk" value={sessionSteps.toLocaleString()} />
          <Metric label="distance" value={`${((sessionSteps * 0.76) / 1_000).toFixed(1)} km`} />
          <Metric label="of goal" value={`${Math.round(progress * 100)}%`} />
        </View>
      </View>

      {day ? (
        <Card variant="outlined">
          <KimboSays line={day.reaction.line} mood={day.reaction.mood} />
        </Card>
      ) : null}

      {isUsingMockActivityProvider ? (
        <Card variant="outlined">
          <View style={{ gap: spacing.sm }}>
            <Text variant="heading">Development controls</Text>
            <View style={[styles.devControls, { gap: spacing.sm }]}>
              <Button onPress={() => mockActivityProvider.increment(250)} size="sm" variant="secondary">+250 steps</Button>
              <Button onPress={() => mockActivityProvider.increment(1_000)} size="sm" variant="secondary">+1,000 steps</Button>
            </View>
          </View>
        </Card>
      ) : null}
      <LiveIslandControl />
      {controller.endError ? <Text accessibilityRole="alert" color="danger" variant="bodySmall">{controller.endError}</Text> : null}
      <Button loading={controller.isSaving} onPress={controller.end} size="lg" variant="danger">End walk safely</Button>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surfaceSunken, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md }]}>
      <Text variant="numericMedium">{value}</Text>
      <Text color="secondary" variant="caption">{label}</Text>
    </View>
  );
}

/** A softly pulsing dot so a running walk feels alive. */
function LiveBadge() {
  const { colors, radius } = useKimboTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1_200, reduceMotion: ReduceMotion.System }), -1, false));
  }, [pulse]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - pulse.get()), transform: [{ scale: 1 + pulse.get() * 1.6 }] }));
  return (
    <View accessibilityLabel="Live" style={[styles.liveBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill }]}>
      <View style={styles.liveDotWrap}>
        <Animated.View style={[styles.liveDot, { backgroundColor: colors.steps }, ringStyle]} />
        <View style={[styles.liveDot, { backgroundColor: colors.steps }]} />
      </View>
      <Text color="steps" variant="caption">LIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: { alignItems: "flex-start", flexDirection: "row" },
  permissionIcon: { alignItems: "center", height: 72, justifyContent: "center", width: 72 },
  permissionCard: { alignItems: "center", flexDirection: "row" },
  permissionCopy: { flex: 1, marginLeft: 12 },
  hero: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, gap: 18, overflow: "hidden" },
  centerText: { maxWidth: 280, textAlign: "center" },
  activeHero: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  walkPill: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  center: { alignItems: "center" },
  eyebrow: { letterSpacing: 1.4 },
  liveBadge: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 7 },
  liveDotWrap: { alignItems: "center", height: 8, justifyContent: "center", width: 8 },
  liveDot: { borderRadius: 99, height: 8, position: "absolute", width: 8 },
  elapsed: { fontFamily: "Manrope_700Bold", fontSize: 56, fontVariant: ["tabular-nums"], letterSpacing: -2.2, lineHeight: 62 },
  metrics: { flexDirection: "row", width: "100%" },
  metric: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: 2 },
  devControls: { flexDirection: "row" },
  strong: { fontFamily: "Manrope_600SemiBold" },
});
