import { assessMealQuality, calculateOverage, calculateRemaining, clampProgress, type MealQuality } from "@kimbo/domain";
import { AudioLines, CalendarDays, ChevronRight, Footprints, PenLine, ScanLine, Utensils } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Card, ProgressBar, ProgressRing, Screen, SurfaceGradient, Text, useKimboTheme } from "@/design-system";
import { LiveIslandControl } from "@/features/activity/components/LiveIslandControl";
import { KimboSays } from "@/features/kimbo/components/KimboSays";
import { useKimboDay } from "@/features/kimbo/hooks/useKimboDay";
import { useRefreshAccount } from "@/features/auth/hooks/useAuth";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ponytail: a process-level flag is exactly "fresh launch": backgrounding keeps the process, so
// the hero fills from zero once per cold start and appears already filled after that.
let hasPlayedLaunchFill = false;
const LAUNCH_FILL_MS = 1_100;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

export function TodayScreen() {
  const router = useRouter();
  const { colors, motion, radius, spacing } = useKimboTheme();
  const day = useKimboDay();
  const refresh = useRefreshAccount();
  const [animateFill] = useState(() => !hasPlayedLaunchFill);
  useEffect(() => {
    hasPlayedLaunchFill = true;
  }, []);

  if (!day) return null;
  const { calories, goal, protein, reaction, session, steps, todaysMeals } = day;

  const remainingCalories = calculateRemaining(calories, goal.dailyCalorieTarget);
  const overCalories = calculateOverage(calories, goal.dailyCalorieTarget);
  const calorieProgress = clampProgress(calories, goal.dailyCalorieTarget);
  const stepProgress = clampProgress(steps, goal.dailyStepTarget);
  const proteinProgress = clampProgress(protein, goal.dailyProteinTargetGrams);
  const remainingSteps = Math.max(0, goal.dailyStepTarget - steps);
  const fill = { animateOnMount: animateFill, duration: animateFill ? LAUNCH_FILL_MS : undefined };
  const balanceTitle = overCalories > 0
    ? `${overCalories.toLocaleString()} kcal over`
    : calories === 0
      ? "A fresh start"
      : calorieProgress >= 0.85
        ? "Nearly there"
        : "On track";

  return (
    <Screen
      contentContainerStyle={{ paddingBottom: spacing.huge * 2.5, paddingTop: spacing.huge + spacing.xxl }}
      refreshControl={<RefreshControl colors={[colors.brand]} onRefresh={() => refresh.mutate()} refreshing={refresh.isPending} tintColor={colors.brand} />}
    >
      <View style={styles.header}>
        <View style={{ gap: spacing.xs }}>
          <Text color="secondary" variant="bodySmall">{getGreeting()}</Text>
          <Text variant="title">Today</Text>
        </View>
        <Pressable
          accessibilityLabel="Open this week"
          accessibilityRole="button"
          hitSlop={spacing.sm}
          onPress={() => router.push("/progress")}
          style={({ pressed }) => [styles.dateChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.pill, opacity: pressed ? 0.8 : 1 }]}
        >
          <CalendarDays color={colors.brand} size={15} strokeWidth={2.2} />
          <Text color="secondary" variant="caption">{dayLabel.format(new Date())}</Text>
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(motion.duration.slow).easing(motion.easing.standard).reduceMotion(ReduceMotion.System)}>
        <View style={[styles.hero, { borderColor: colors.border, borderRadius: radius.xl, gap: spacing.lg }]}>
          <SurfaceGradient borderRadius={radius.xl} from={colors.heroWashFrom} to={colors.heroWashTo} />
          <SurfaceGradient borderRadius={radius.xl} center={{ x: 0.9, y: 0 }} from={colors.heroGlow} to={colors.heroGlowFade} variant="radial" />
          <View style={styles.heroHeader}>
            <View style={{ gap: spacing.xs }}>
              <Text color="secondary" style={styles.eyebrow} variant="caption">DAILY BALANCE</Text>
              <Text variant="heading">{balanceTitle}</Text>
            </View>
            <View style={[styles.targetPill, { backgroundColor: colors.brandSoft, borderRadius: radius.pill }]}>
              <Text color="brand" variant="caption">{goal.dailyCalorieTarget.toLocaleString()} kcal</Text>
            </View>
          </View>

          <View style={styles.ringWrap}>
            <ProgressRing
              {...fill}
              accessibilityLabel={`${calories} of ${goal.dailyCalorieTarget} calories eaten`}
              color={colors.calories}
              size={196}
              strokeWidth={12}
              trackColor={colors.surfaceInteractive}
              value={calorieProgress}
            >
              <Text variant="numericLarge">{(overCalories > 0 ? overCalories : remainingCalories).toLocaleString()}</Text>
              <Text color="secondary" variant="bodySmall">{overCalories > 0 ? "kcal over" : "kcal left"}</Text>
              <Text color="muted" style={{ marginTop: spacing.xs }} variant="caption">{calories.toLocaleString()} eaten</Text>
            </ProgressRing>
          </View>

          <View style={[styles.heroMetrics, { gap: spacing.sm }]}>
            <HeroMetric
              {...fill}
              accent={colors.steps}
              gradient={colors.gradientSteps}
              label="Movement"
              progress={stepProgress}
              target={`/ ${goal.dailyStepTarget.toLocaleString()}`}
              value={steps.toLocaleString()}
            />
            <HeroMetric
              {...fill}
              accent={colors.protein}
              gradient={colors.gradientProtein}
              label="Protein"
              progress={proteinProgress}
              target={`/ ${goal.dailyProteinTargetGrams} g`}
              value={`${protein} g`}
            />
          </View>
        </View>
      </Animated.View>

      <Card style={[styles.kimboCard, { borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg }]} variant="outlined">
        <KimboSays line={reaction.line} mood={reaction.mood} />
      </Card>

      <View style={{ gap: spacing.md }}>
        <View style={styles.sectionHeading}>
          <Text variant="heading">Log a meal</Text>
          <Text color="muted" variant="caption">You review before it saves</Text>
        </View>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <QuickAction accent={colors.brand} icon={AudioLines} label="Speak" onPress={() => router.push("/meal/voice")} />
          <QuickAction accent={colors.steps} icon={ScanLine} label="Snap" onPress={() => router.push("/meal/camera")} />
          <QuickAction accent={colors.protein} icon={PenLine} label="Type" onPress={() => router.push("/meal/manual")} />
        </View>
      </View>

      <ActionCard
        description={session ? "Your walk is live. Tap to see it." : remainingSteps > 0 ? `${remainingSteps.toLocaleString()} steps to today's goal` : "Goal reached. A bonus walk still counts."}
        icon={<Footprints color={colors.steps} size={24} strokeWidth={2.1} />}
        label={session ? "Walking now" : "Start a walk"}
        onPress={() => router.push("/activity")}
      />

      {todaysMeals.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionHeading}>
            <Text variant="heading">Today&apos;s plate</Text>
            <Text color="secondary" variant="bodySmall">{todaysMeals.length} logged</Text>
          </View>
          {todaysMeals.map((meal) => (
            <View key={meal.id} style={[styles.mealRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, gap: spacing.md, padding: spacing.md }]}>
              <View style={[styles.mealIcon, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md }]}>
                <Utensils color={colors.textSecondary} size={18} strokeWidth={2} />
              </View>
              <View style={[styles.mealCopy, { gap: 2 }]}>
                <Text numberOfLines={1} style={styles.strong} variant="bodySmall">{meal.items.map((item) => item.name).join(", ")}</Text>
                <View style={[styles.mealMeta, { gap: spacing.sm }]}>
                  <Text color="muted" style={styles.mealMetaText} variant="caption">{meal.mealType[0]?.toUpperCase()}{meal.mealType.slice(1)} · {Math.round(meal.totals.proteinGrams)} g protein</Text>
                  <QualityChip quality={assessMealQuality(meal.totals)} />
                </View>
              </View>
              <Text style={styles.mealCalories} variant="numericMedium">{Math.round(meal.totals.calories)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <LiveIslandControl />
    </Screen>
  );
}

function HeroMetric({
  accent,
  animateOnMount,
  duration,
  gradient,
  label,
  progress,
  target,
  value,
}: {
  accent: string;
  animateOnMount: boolean;
  duration?: number;
  gradient: readonly [string, string];
  label: string;
  progress: number;
  target: string;
  value: string;
}) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <View style={[styles.heroMetric, { backgroundColor: colors.surfaceSunken, borderColor: colors.border, borderRadius: radius.lg, gap: spacing.xs, padding: spacing.md }]}>
      <View style={[styles.row, { alignItems: "center", gap: 6 }]}>
        <View style={[styles.metricDot, { backgroundColor: accent }]} />
        <Text color="secondary" variant="caption">{label}</Text>
      </View>
      <Text numberOfLines={1} variant="bodySmall">
        <Text style={styles.strong} variant="bodySmall">{value} </Text>
        <Text color="muted" variant="caption">{target}</Text>
      </Text>
      <ProgressBar
        accessibilityLabel={`${label} ${Math.round(progress * 100)} percent`}
        animateOnMount={animateOnMount}
        duration={duration}
        gradient={gradient}
        height={5}
        style={{ marginTop: spacing.xs }}
        trackColor={colors.surfaceInteractive}
        value={progress}
      />
    </View>
  );
}

const qualityStyle: Record<MealQuality, { label: string; tone: "success" | "secondary" | "warning" | "danger" }> = {
  great: { label: "Protein-rich", tone: "success" },
  balanced: { label: "Balanced", tone: "secondary" },
  heavy: { label: "Heavy", tone: "warning" },
  poor: { label: "Low protein", tone: "danger" },
};

function QualityChip({ quality }: { quality: MealQuality }) {
  const { colors, radius } = useKimboTheme();
  const { label, tone } = qualityStyle[quality];
  const color = tone === "secondary" ? colors.textSecondary : colors[tone];
  return (
    <View style={[styles.chip, { borderColor: color, borderRadius: radius.pill }]}>
      <Text style={[styles.chipText, { color }]} variant="caption">{label}</Text>
    </View>
  );
}

function QuickAction({
  accent,
  icon: Icon,
  label,
  onPress,
}: {
  accent: string;
  icon: typeof AudioLines;
  label: string;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useKimboTheme();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.get() * 0.04 }] }));
  return (
    <AnimatedPressable
      accessibilityLabel={`${label} a meal`}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => pressed.set(withSpring(1, { duration: 110, dampingRatio: 1, reduceMotion: ReduceMotion.System }))}
      onPressOut={() => pressed.set(withSpring(0, { duration: 200, dampingRatio: 0.8, reduceMotion: ReduceMotion.System }))}
      style={[styles.quickAction, { borderColor: colors.border, borderRadius: radius.lg, gap: spacing.sm, padding: spacing.md }, animatedStyle]}
    >
      <SurfaceGradient borderRadius={radius.lg} from={colors.surfaceElevated} to={colors.surface} variant="vertical" />
      <View style={[styles.quickIcon, { borderColor: accent, borderRadius: radius.md }]}>
        <Icon color={accent} size={22} strokeWidth={2.1} />
      </View>
      <Text style={styles.strong} variant="bodySmall">{label}</Text>
    </AnimatedPressable>
  );
}

function ActionCard({ description, icon, label, onPress }: { description: string; icon: ReactNode; label: string; onPress: () => void }) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <Pressable
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, { borderColor: colors.border, borderRadius: radius.xl, gap: spacing.md, opacity: pressed ? 0.85 : 1, padding: spacing.lg }]}
    >
      <SurfaceGradient borderRadius={radius.xl} from={colors.surfaceElevated} to={colors.surface} />
      <View style={[styles.actionIcon, { backgroundColor: colors.surfaceSunken, borderRadius: radius.lg }]}>{icon}</View>
      <View style={[styles.flex, { gap: 2 }]}>
        <Text variant="heading">{label}</Text>
        <Text color="secondary" variant="bodySmall">{description}</Text>
      </View>
      <ChevronRight color={colors.textMuted} size={20} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: "row" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  dateChip: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 6, minHeight: 36, paddingHorizontal: 12 },
  hero: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", padding: 20 },
  heroHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  eyebrow: { letterSpacing: 1.2 },
  targetPill: { paddingHorizontal: 10, paddingVertical: 5 },
  ringWrap: { alignItems: "center", justifyContent: "center" },
  heroMetrics: { flexDirection: "row" },
  heroMetric: { borderWidth: StyleSheet.hairlineWidth, flex: 1 },
  metricDot: { borderRadius: 99, height: 6, width: 6 },
  kimboCard: { borderWidth: StyleSheet.hairlineWidth },
  sectionHeading: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  quickAction: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flex: 1, minHeight: 100, overflow: "hidden" },
  quickIcon: { alignItems: "center", borderWidth: 1.5, height: 44, justifyContent: "center", width: 44 },
  actionCard: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", overflow: "hidden" },
  actionIcon: { alignItems: "center", height: 48, justifyContent: "center", width: 48 },
  mealRow: { alignItems: "center", borderWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  mealIcon: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  mealCopy: { flex: 1, minWidth: 0 },
  mealMeta: { alignItems: "center", flexDirection: "row", flexWrap: "wrap" },
  mealMetaText: { flexShrink: 1 },
  mealCalories: { flexShrink: 0, textAlign: "right" },
  chip: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 1 },
  chipText: { fontSize: 10, letterSpacing: 0.4, lineHeight: 14 },
  strong: { fontFamily: "Manrope_600SemiBold" },
});
