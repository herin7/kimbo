import { reactToWeek } from "@kimbo/domain";
import { CalendarDays, Flame } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card, ProgressBar, Screen, Text, useKimboTheme } from "@/design-system";
import { KimboSays } from "@/features/kimbo/components/KimboSays";

import { buildProgressOverview, type ProgressDay, type ProgressRange } from "../domain/build-progress-overview";
import { useProgressHistory } from "../hooks/useProgressHistory";

const rangeDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const ranges: readonly { value: ProgressRange; label: string }[] = [
  { value: "1Y", label: "1 year" },
  { value: "6M", label: "6 months" },
  { value: "3M", label: "3 months" },
];

export function ProgressScreen() {
  const { colors, radius, spacing } = useKimboTheme();
  const { data, isLoading } = useProgressHistory();
  const [range, setRange] = useState<ProgressRange>("1Y");
  const overview = useMemo(() => data ? buildProgressOverview(data, range) : null, [data, range]);

  if (isLoading || !overview) {
    return <Screen contentContainerStyle={{ paddingTop: spacing.huge + spacing.xxl }}><Text color="secondary">Reading your progress...</Text></Screen>;
  }

  const first = new Date(`${overview.days[0]?.date}T00:00:00`);
  const last = new Date(`${overview.days.at(-1)?.date}T00:00:00`);
  const kimbo = reactToWeek({
    caloriesPercent: overview.caloriesPercent,
    movementPercent: overview.movementPercent,
    proteinPercent: overview.proteinPercent,
    daysWithData: overview.activeDays,
    weakestMetric: overview.weakestMetric,
  });

  return (
    <Screen contentContainerStyle={{ paddingBottom: spacing.huge * 2, paddingTop: spacing.huge + spacing.xxl }}>
      <View style={[styles.header, { gap: spacing.md }]}>
        <View style={[styles.calendarIcon, { backgroundColor: colors.brandSoft, borderRadius: radius.lg }]}>
          <CalendarDays color={colors.brand} size={23} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text color="secondary" variant="caption">OVERALL PROGRESS</Text>
          <Text variant="title">Your rhythm</Text>
          <Text color="secondary" variant="bodySmall">{rangeDate.format(first)} - {rangeDate.format(last)}</Text>
        </View>
      </View>

      <View accessibilityRole="tablist" style={[styles.rangePicker, { backgroundColor: colors.surfaceSunken, borderColor: colors.border, borderRadius: radius.pill, padding: spacing.xs }]}>
        {ranges.map((item) => {
          const selected = item.value === range;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.value}
              onPress={() => setRange(item.value)}
              style={({ pressed }) => [
                styles.rangeOption,
                { backgroundColor: selected ? colors.surfaceElevated : "transparent", borderRadius: radius.pill, opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <Text color={selected ? "primary" : "muted"} style={selected ? styles.strong : undefined} variant="bodySmall">{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={[styles.streakCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}>
        <View style={styles.streakLead}>
          <View style={[styles.flame, { backgroundColor: colors.brandSoft, borderRadius: radius.pill }]}>
            <Flame color={colors.brand} fill={colors.brand} size={24} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text color="secondary" variant="caption">CURRENT STREAK</Text>
            <View style={styles.streakValue}>
              <Text variant="numericLarge">{overview.currentStreak}</Text>
              <Text color="secondary" variant="body">days</Text>
            </View>
          </View>
        </View>
        <View style={[styles.statRow, { borderTopColor: colors.border, paddingTop: spacing.lg }]}>
          <Stat label="Best streak" value={`${overview.bestStreak} days`} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <Stat label="Days recorded" value={String(overview.activeDays)} />
        </View>
      </Card>

      <Card style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}>
        <View>
          <Text variant="heading">Consistency map</Text>
          <Text color="secondary" variant="bodySmall">Each square is one day. Deeper colour means more goals met.</Text>
        </View>
        <ProgressCalendar days={overview.days} />
        <View style={styles.legend}>
          <Text color="muted" variant="caption">Less</Text>
          {[null, 0.35, 0.65, 0.9].map((score, index) => <HeatCell compact key={index} score={score} />)}
          <Text color="muted" variant="caption">More</Text>
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <MetricRow color={colors.calories} gradient={colors.gradientCalories} label="Calories" value={overview.caloriesPercent} />
        <MetricRow color={colors.steps} gradient={colors.gradientSteps} label="Movement" value={overview.movementPercent} />
        <MetricRow color={colors.protein} gradient={colors.gradientProtein} label="Protein" value={overview.proteinPercent} />
      </View>

      <Card style={[styles.insight, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]} variant="outlined">
        <KimboSays line={kimbo.line} mood={kimbo.mood} />
        <Text style={{ marginTop: spacing.sm }} variant="heading">{"Kimbo's read"}</Text>
        <Text color="secondary">
          {overview.activeDays > 0
            ? `${overview.activeDays} recorded days give Kimbo enough signal to keep pushing the habit that needs it most.`
            : "Log a meal or take a walk and your first streak starts here."}
        </Text>
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.strong} variant="body">{value}</Text><Text color="muted" variant="caption">{label}</Text></View>;
}

function ProgressCalendar({ days }: { days: ProgressDay[] }) {
  const startDay = (new Date(`${days[0]?.date}T00:00:00`).getDay() + 6) % 7;
  const padded: (ProgressDay | null)[] = [...Array.from({ length: startDay }, () => null), ...days];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks = Array.from({ length: padded.length / 7 }, (_, index) => padded.slice(index * 7, index * 7 + 7));
  return (
    <View accessibilityLabel={`Progress calendar with ${days.filter((day) => day.score !== null).length} recorded days`} style={styles.heatmap}>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekColumn}>
          {week.map((day, dayIndex) => <HeatCell key={day?.date ?? `${weekIndex}-${dayIndex}`} score={day?.score} />)}
        </View>
      ))}
    </View>
  );
}

function HeatCell({ compact = false, score }: { compact?: boolean; score: number | null | undefined }) {
  const { colors, radius } = useKimboTheme();
  const backgroundColor = score == null
    ? colors.surfaceInteractive
    : score >= 0.82
      ? colors.success
      : score >= 0.58
        ? colors.steps
        : colors.brandSoft;
  return <View style={[styles.heatCell, compact ? styles.legendCell : styles.calendarCell, { backgroundColor, borderRadius: radius.sm / 2 }]} />;
}

function MetricRow({ color, gradient, label, value }: { color: string; gradient: readonly [string, string]; label: string; value: number }) {
  const { colors, radius, spacing } = useKimboTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}>
      <View style={styles.metricHeading}>
        <View style={[styles.metricName, { gap: spacing.sm }]}><View style={[styles.metricDot, { backgroundColor: color }]} /><Text style={styles.strong}>{label}</Text></View>
        <Text variant="numericMedium">{value}%</Text>
      </View>
      <ProgressBar accessibilityLabel={`${label} consistency ${value} percent`} gradient={gradient} height={5} style={styles.progress} trackColor={colors.surfaceInteractive} value={value / 100} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row" },
  calendarIcon: { alignItems: "center", height: 48, justifyContent: "center", width: 48 },
  rangePicker: { borderWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  rangeOption: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 40 },
  strong: { fontFamily: "Manrope_600SemiBold" },
  streakCard: { borderWidth: StyleSheet.hairlineWidth, gap: 18 },
  streakLead: { alignItems: "center", flexDirection: "row", gap: 14 },
  flame: { alignItems: "center", height: 52, justifyContent: "center", width: 52 },
  streakValue: { alignItems: "baseline", flexDirection: "row", gap: 8 },
  statRow: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  stat: { alignItems: "center", flex: 1, gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth },
  calendarCard: { borderWidth: StyleSheet.hairlineWidth, gap: 18 },
  heatmap: { flexDirection: "row", gap: 2, width: "100%" },
  weekColumn: { flex: 1, gap: 2 },
  heatCell: { aspectRatio: 1 },
  calendarCell: { width: "100%" },
  legendCell: { width: 8 },
  legend: { alignItems: "center", alignSelf: "flex-end", flexDirection: "row", gap: 4 },
  metric: { borderWidth: StyleSheet.hairlineWidth },
  metricHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  metricName: { alignItems: "center", flexDirection: "row" },
  metricDot: { borderRadius: 99, height: 8, width: 8 },
  progress: { marginTop: 14 },
  insight: { gap: 12 },
});
