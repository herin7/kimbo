import { reactToWeek } from "@kimbo/domain";
import { CalendarDays } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";

import { Card, ProgressBar, Screen, Text, useKimboTheme } from "@/design-system";
import { KimboSays } from "@/features/kimbo/components/KimboSays";

import { useWeeklyProgress } from "../hooks/useWeeklyProgress";

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
const rangeDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function ProgressScreen() {
  const { colors, motion, radius, spacing } = useKimboTheme();
  const { data, isLoading } = useWeeklyProgress();

  if (isLoading || !data) {
    return <Screen contentContainerStyle={{ paddingTop: spacing.huge + spacing.xxl }}><Text color="secondary">Building your week…</Text></Screen>;
  }

  const weekStart = new Date(`${data.weekStart}T00:00:00`);
  const weekEnd = new Date(`${data.weekEnd}T00:00:00`);
  const hasHistory = data.insight.facts.daysWithData > 0;
  const kimbo = reactToWeek({ ...data.adherence, daysWithData: data.insight.facts.daysWithData, weakestMetric: data.insight.facts.weakestMetric });

  return (
    <Screen contentContainerStyle={{ paddingBottom: spacing.huge * 2, paddingTop: spacing.huge + spacing.xxl }}>
      <View style={[styles.header, { gap: spacing.md }]}>
        <View style={[styles.calendarIcon, { backgroundColor: colors.brandSoft, borderRadius: radius.lg }]}>
          <CalendarDays color={colors.brand} size={23} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text color="secondary" variant="caption">THIS WEEK</Text>
          <Text variant="title">{rangeDate.format(weekStart)}–{rangeDate.format(weekEnd)}</Text>
        </View>
      </View>

      <Card style={[styles.weekCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}>
        <View style={styles.weekHeading}>
          <Text variant="heading">Consistency</Text>
          <Text color="secondary" variant="bodySmall">{data.insight.facts.daysWithData} of 7 days</Text>
        </View>
        <View accessibilityLabel={`${data.insight.facts.daysWithData} days with health data`} style={[styles.weekRow, { marginTop: spacing.xl }]}>
          {data.days.map((day) => {
            const hasData = day.hasMealData || day.hasActivityData;
            const isToday = day.date === new Date().toISOString().slice(0, 10);
            return (
              <View key={day.date} style={[styles.day, { gap: spacing.sm }]}>
                <View style={[styles.dayBar, { backgroundColor: hasData ? colors.brand : colors.surfaceInteractive, borderColor: isToday ? colors.textPrimary : "transparent", borderRadius: radius.pill }]} />
                <Text color={isToday ? "primary" : "muted"} variant="caption">{weekday.format(new Date(`${day.date}T00:00:00`))}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <MetricRow color={colors.calories} gradient={colors.gradientCalories} index={0} label="Calories" value={data.adherence.caloriesPercent} />
        <MetricRow color={colors.steps} gradient={colors.gradientSteps} index={1} label="Movement" value={data.adherence.movementPercent} />
        <MetricRow color={colors.protein} gradient={colors.gradientProtein} index={2} label="Protein" value={data.adherence.proteinPercent} />
      </View>

      <Animated.View entering={FadeInDown.delay(140).duration(motion.duration.slow).easing(motion.easing.standard).reduceMotion(ReduceMotion.System)}>
        <Card style={[styles.insight, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]} variant="outlined">
          <KimboSays line={kimbo.line} mood={kimbo.mood} />
          <Text style={{ marginTop: spacing.sm }} variant="heading">{hasHistory ? "One useful pattern" : "Start with one signal"}</Text>
          <Text color="secondary">{data.insight.message}</Text>
        </Card>
      </Animated.View>
    </Screen>
  );
}

function MetricRow({ color, gradient, index, label, value }: { color: string; gradient: readonly [string, string]; index: number; label: string; value: number }) {
  const { colors, motion, radius, spacing } = useKimboTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * 55).duration(motion.duration.normal).easing(motion.easing.standard).reduceMotion(ReduceMotion.System)}>
      <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}>
        <View style={styles.metricHeading}>
          <View style={[styles.metricName, { gap: spacing.sm }]}>
            <View style={[styles.metricDot, { backgroundColor: color }]} />
            <Text style={styles.strong}>{label}</Text>
          </View>
          <Text variant="numericMedium">{value}%</Text>
        </View>
        <ProgressBar accessibilityLabel={`${label} weekly consistency ${value} percent`} gradient={gradient} height={5} style={styles.progress} trackColor={colors.surfaceInteractive} value={value / 100} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row" },
  calendarIcon: { alignItems: "center", height: 48, justifyContent: "center", width: 48 },
  weekCard: { borderWidth: StyleSheet.hairlineWidth },
  weekHeading: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  day: { alignItems: "center" },
  dayBar: { borderWidth: 1, height: 46, width: 8 },
  metric: { borderWidth: StyleSheet.hairlineWidth },
  metricHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  metricName: { alignItems: "center", flexDirection: "row" },
  metricDot: { borderRadius: 99, height: 8, width: 8 },
  progress: { marginTop: 14 },
  insight: { gap: 12 },
  strong: { fontFamily: "Manrope_600SemiBold" },
});
