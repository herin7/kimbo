import type { ActivitySession, ConfirmedMeal, DailyHealthSummary, HealthGoal } from "@kimbo/contracts";

export type ProgressRange = "3M" | "6M" | "1Y";

export interface ProgressDay extends DailyHealthSummary {
  score: number | null;
}

export interface ProgressOverview {
  days: ProgressDay[];
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  caloriesPercent: number;
  movementPercent: number;
  proteinPercent: number;
  weakestMetric: "calories" | "movement" | "protein" | null;
}

const DAYS_BY_RANGE: Record<ProgressRange, number> = { "3M": 91, "6M": 183, "1Y": 365 };

export const toLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ratio = (value: number | null, target: number) => target > 0 && value !== null ? Math.min(1, value / target) : null;

export function mergeProgressHistory(input: {
  summaries: DailyHealthSummary[];
  goal: HealthGoal;
  meals: ConfirmedMeal[];
  sessions: ActivitySession[];
  todaySteps: number;
  now?: Date;
}) {
  const byDate = new Map(input.summaries.map((summary) => [summary.date, summary]));
  const mealsByDate = new Map<string, ConfirmedMeal[]>();
  for (const meal of input.meals) {
    const key = toLocalDate(new Date(meal.occurredAt));
    mealsByDate.set(key, [...(mealsByDate.get(key) ?? []), meal]);
  }
  const sessionsByDate = new Map<string, ActivitySession[]>();
  for (const session of input.sessions) {
    const key = toLocalDate(new Date(session.startedAt));
    sessionsByDate.set(key, [...(sessionsByDate.get(key) ?? []), session]);
  }

  const keys = new Set([...byDate.keys(), ...mealsByDate.keys(), ...sessionsByDate.keys()]);
  const today = toLocalDate(input.now ?? new Date());
  if (input.todaySteps > 0) keys.add(today);
  for (const key of keys) {
    const existing = byDate.get(key);
    const meals = mealsByDate.get(key) ?? [];
    const sessions = sessionsByDate.get(key) ?? [];
    const localSteps = sessions.reduce<number | null>((highest, session) => {
      const value = session.endingSteps ?? session.currentSteps;
      return highest === null ? value : Math.max(highest, value);
    }, null);
    const todaySteps = key === today && input.todaySteps > 0 ? input.todaySteps : null;
    const steps = todaySteps ?? localSteps ?? existing?.steps ?? null;
    byDate.set(key, {
      date: key,
      calories: meals.length > 0 ? Math.round(meals.reduce((sum, meal) => sum + meal.totals.calories, 0)) : existing?.calories ?? 0,
      calorieTarget: input.goal.dailyCalorieTarget,
      proteinGrams: meals.length > 0 ? meals.reduce((sum, meal) => sum + meal.totals.proteinGrams, 0) : existing?.proteinGrams ?? 0,
      proteinTargetGrams: input.goal.dailyProteinTargetGrams,
      steps,
      stepTarget: input.goal.dailyStepTarget,
      hasMealData: meals.length > 0 || existing?.hasMealData === true,
      hasActivityData: steps !== null || existing?.hasActivityData === true,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildProgressOverview(summaries: DailyHealthSummary[], range: ProgressRange, now = new Date()): ProgressOverview {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - DAYS_BY_RANGE[range] + 1);
  const byDate = new Map(summaries.map((summary) => [summary.date, summary]));
  const days: ProgressDay[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = toLocalDate(cursor);
    const stored = byDate.get(key);
    const summary: DailyHealthSummary = stored ?? {
      date: key,
      calories: 0,
      calorieTarget: 1,
      proteinGrams: 0,
      proteinTargetGrams: 1,
      steps: null,
      stepTarget: 1,
      hasMealData: false,
      hasActivityData: false,
    };
    const scores = [
      summary.hasMealData ? Math.max(0, 1 - Math.abs(summary.calories - summary.calorieTarget) / summary.calorieTarget) : null,
      summary.hasMealData ? ratio(summary.proteinGrams, summary.proteinTargetGrams) : null,
      summary.hasActivityData ? ratio(summary.steps, summary.stepTarget) : null,
    ].filter((value): value is number => value !== null);
    days.push({ ...summary, score: scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null });
  }

  const active = days.map((day) => day.score !== null);
  let bestStreak = 0;
  let running = 0;
  for (const hasData of active) {
    running = hasData ? running + 1 : 0;
    bestStreak = Math.max(bestStreak, running);
  }
  let currentIndex = active.length - 1;
  if (!active[currentIndex]) currentIndex -= 1;
  let currentStreak = 0;
  while (currentIndex >= 0 && active[currentIndex]) {
    currentStreak += 1;
    currentIndex -= 1;
  }

  const recorded = days.filter((day) => day.score !== null);
  const average = (values: number[]) => values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) : 0;
  const mealDays = recorded.filter((day) => day.hasMealData);
  const movementDays = recorded.filter((day) => day.hasActivityData && day.steps !== null);
  const caloriesPercent = average(mealDays.map((day) => Math.max(0, 1 - Math.abs(day.calories - day.calorieTarget) / day.calorieTarget)));
  const proteinPercent = average(mealDays.map((day) => ratio(day.proteinGrams, day.proteinTargetGrams) ?? 0));
  const movementPercent = average(movementDays.map((day) => ratio(day.steps, day.stepTarget) ?? 0));
  const metrics: [NonNullable<ProgressOverview["weakestMetric"]>, number][] = [];
  if (mealDays.length > 0) metrics.push(["calories", caloriesPercent], ["protein", proteinPercent]);
  if (movementDays.length > 0) metrics.push(["movement", movementPercent]);
  const weakestMetric = metrics.sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;

  return { days, activeDays: recorded.length, currentStreak, bestStreak, caloriesPercent, movementPercent, proteinPercent, weakestMetric };
}
