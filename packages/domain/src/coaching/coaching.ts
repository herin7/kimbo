import type { DailyHealthSummary } from "@kimbo/contracts";

import type { KimboMood, KimboTopic } from "../kimbo/kimbo-reactions.js";

export interface CoachingDay {
  date: string;
  minute: number;
  weekday: number;
  calorieTarget: number;
  proteinTargetGrams: number;
  stepTarget: number;
  meals: { minute: number; calories: number; proteinGrams: number }[];
  steps: number | null;
  history: DailyHealthSummary[];
  sentToday: string[];
}

export type InsightType = "protein-behind" | "calories-fast" | "steps-behind" | "back-on-track" | "goal-achieved" | "weekly-reflection";
export interface Insight {
  key: string;
  type: InsightType;
  kind: "nudge" | "feedback" | "weekly";
  priority: number;
  mood: KimboMood;
  topic: KimboTopic;
  title: string;
  explanation: string;
  action: { label: string; route: "/meal/capture" | "/activity" | "/progress" };
  actionable: boolean;
  actionableUntil: number | null;
}

export interface WeeklyReflection extends Insight {
  type: "weekly-reflection";
  kind: "weekly";
  wentWell: string;
  pattern: string;
  focus: string;
}

type PacePoint = readonly [minute: number, fraction: number];
const FOOD_CURVE: readonly PacePoint[] = [[420, 0], [570, 0.25], [840, 0.6], [1050, 0.7], [1260, 0.95], [1320, 1]];
const STEP_CURVE: readonly PacePoint[] = [[420, 0], [720, 0.35], [1020, 0.65], [1200, 0.85], [1320, 1]];

const fmt = (value: number) => Math.round(value).toLocaleString("en-IN");
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function curveAt(curve: readonly PacePoint[], minute: number) {
  if (minute <= curve[0]![0]) return curve[0]![1];
  for (let index = 1; index < curve.length; index += 1) {
    const previous = curve[index - 1]!;
    const next = curve[index]!;
    if (minute <= next[0]) {
      const progress = (minute - previous[0]) / (next[0] - previous[0]);
      return previous[1] + progress * (next[1] - previous[1]);
    }
  }
  return curve.at(-1)![1];
}

export function localClock(at: Date, timeZone: string): { date: string; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday"));
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minute: Number(value("hour")) * 60 + Number(value("minute")),
    weekday,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? 0;
}

export function evaluateDay(day: CoachingDay): Insight[] {
  const calories = day.meals.reduce((sum, meal) => sum + meal.calories, 0);
  const protein = day.meals.reduce((sum, meal) => sum + meal.proteinGrams, 0);
  const foodPace = curveAt(FOOD_CURVE, day.minute);
  const stepPace = curveAt(STEP_CURVE, day.minute);
  const insights: Insight[] = [];
  const proteinKey = `protein-behind:${day.date}`;
  const stepsKey = `steps-behind:${day.date}`;

  if (day.meals.length >= 1 && day.minute >= 660 && protein < 0.6 * foodPace * day.proteinTargetGrams) {
    const left = Math.max(0, day.proteinTargetGrams - protein);
    const remainingMeals = (day.minute <= 870 ? 1 : 0) + (day.minute <= 1260 ? 1 : 0);
    const perMeal = remainingMeals > 0 ? Math.ceil(left / remainingMeals) : left;
    const actionable = remainingMeals > 0 && perMeal <= 45;
    const gap = day.proteinTargetGrams > 0 ? left / day.proteinTargetGrams : 0;
    insights.push({
      key: proteinKey,
      type: "protein-behind",
      kind: "nudge",
      priority: Math.round(70 + clamp(gap * 10, 0, 10)),
      mood: day.minute < 1080 ? "sad" : "angry",
      topic: "protein",
      title: `🥚 Protein check · ${fmt(left)} g to go`,
      explanation: actionable
        ? `You're at ${fmt(protein)} g of ${fmt(day.proteinTargetGrams)}. About ${fmt(perMeal)} g in each remaining meal keeps the target realistic.`
        : `You're at ${fmt(protein)} g of ${fmt(day.proteinTargetGrams)}. That gap is too large to chase in one meal, so make the next plate protein-forward without forcing it.`,
      action: { label: actionable ? `Add ~${fmt(perMeal)} g: paneer, dal, eggs` : "Log a balanced meal", route: "/meal/capture" },
      actionable,
      actionableUntil: 1260,
    });
  }

  if (day.minute < 1020 && calories >= Math.max(0.85 * day.calorieTarget, (foodPace + 0.3) * day.calorieTarget)) {
    const fraction = day.calorieTarget > 0 ? calories / day.calorieTarget : 0;
    insights.push({
      key: `calories-fast:${day.date}`,
      type: "calories-fast",
      kind: "nudge",
      priority: Math.round(60 + clamp((fraction - 0.85) * 20, 0, 10)),
      mood: "sad",
      topic: "calories",
      title: "🥗 Plan a lighter finish",
      explanation: `You've logged ${fmt(calories)} of ${fmt(day.calorieTarget)} kcal. A protein-and-veg dinner plus a short walk can keep the rest of the day steady.`,
      action: { label: "Plan a lighter dinner", route: "/meal/capture" },
      actionable: true,
      actionableUntil: 1200,
    });
  }

  if (day.steps !== null && day.minute >= 660 && day.minute <= 1230 && day.steps < 0.7 * stepPace * day.stepTarget) {
    const stepsLeft = Math.max(0, day.stepTarget - day.steps);
    const minutesNeeded = Math.ceil(stepsLeft / 100);
    const historySteps = day.history.flatMap((entry) => entry.steps === null ? [] : [entry.steps]);
    const typicalDaily = historySteps.length >= 3 ? median(historySteps) : day.stepTarget;
    const typicalNow = Math.round(typicalDaily * stepPace / 100) * 100;
    const gap = day.stepTarget > 0 ? stepsLeft / day.stepTarget : 0;
    insights.push({
      key: stepsKey,
      type: "steps-behind",
      kind: "nudge",
      priority: Math.round(65 + clamp(gap * 10, 0, 10)),
      mood: day.minute < 1020 ? "sad" : "angry",
      topic: "movement",
      title: `🚶 Movement check · ${fmt(stepsLeft)} left`,
      explanation: `${fmt(day.steps)} steps so far; you usually have about ${fmt(typicalNow)} by now. ${minutesNeeded <= 60 ? `About ${minutesNeeded} walking minutes closes the gap.` : "A 20-minute walk still earns useful partial credit."}`,
      action: { label: minutesNeeded <= 60 ? `Walk about ${minutesNeeded} minutes` : "Take a 20-minute walk", route: "/activity" },
      actionable: true,
      actionableUntil: 1260,
    });
  }

  if (day.sentToday.includes(proteinKey) && protein >= 0.85 * foodPace * day.proteinTargetGrams) {
    insights.push({
      key: `back-on-track:protein:${day.date}`,
      type: "back-on-track",
      kind: "feedback",
      priority: 80,
      mood: "happy",
      topic: "protein",
      title: "💛 Protein is back on pace",
      explanation: `You're at ${fmt(protein)} g now. That last meal brought the day back into a comfortable range.`,
      action: { label: "Keep logging meals", route: "/meal/capture" },
      actionable: true,
      actionableUntil: 1320,
    });
  }
  if (day.steps !== null && day.sentToday.includes(stepsKey) && day.steps >= 0.85 * stepPace * day.stepTarget) {
    insights.push({
      key: `back-on-track:steps:${day.date}`,
      type: "back-on-track",
      kind: "feedback",
      priority: 80,
      mood: "happy",
      topic: "movement",
      title: "💛 That walk did it",
      explanation: `${fmt(day.steps)} steps puts movement back on pace. Nice recovery.`,
      action: { label: "See today's progress", route: "/progress" },
      actionable: true,
      actionableUntil: 1320,
    });
  }

  const proteinDone = protein >= day.proteinTargetGrams;
  const stepsDone = day.steps !== null && day.steps >= day.stepTarget;
  if (proteinDone || stepsDone) {
    const metric = proteinDone && stepsDone ? "both" : proteinDone ? "protein" : "steps";
    insights.push({
      key: `goal-achieved:${metric}:${day.date}`,
      type: "goal-achieved",
      kind: "feedback",
      priority: metric === "both" ? 85 : 75,
      mood: metric === "both" ? "playful" : "happy",
      topic: metric === "both" ? "goals" : metric === "protein" ? "protein" : "movement",
      title: metric === "both" ? "✨ Both goals complete" : metric === "protein" ? "💪 Protein goal complete" : "🎉 Step goal complete",
      explanation: metric === "both" ? "Protein and movement are both covered today. That's a day worth repeating." : metric === "protein" ? `You reached ${fmt(protein)} g of protein today.` : `You reached ${fmt(day.steps ?? 0)} steps today.`,
      action: { label: "See today's progress", route: "/progress" },
      actionable: true,
      actionableUntil: 1320,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
}

const hitCounts = (days: DailyHealthSummary[]) => ({
  protein: days.filter((day) => day.hasMealData && day.proteinGrams >= 0.9 * day.proteinTargetGrams).length,
  movement: days.filter((day) => day.hasActivityData && day.steps !== null && day.steps >= day.stepTarget).length,
  calories: days.filter((day) => day.hasMealData && day.calories <= day.calorieTarget).length,
});

export function buildWeeklyReflection(week: DailyHealthSummary[], previous: DailyHealthSummary[]): WeeklyReflection {
  if (week.length !== 7) throw new Error("Weekly reflection requires exactly seven days");
  const current = hitCounts(week);
  const before = hitCounts(previous);
  const labels = { protein: "protein", movement: "movement", calories: "calories" } as const;
  const metrics = (Object.keys(current) as Array<keyof typeof current>).map((metric) => ({ metric, hits: current[metric], improvement: current[metric] - before[metric] }));
  const best = [...metrics].sort((a, b) => b.improvement - a.improvement || b.hits - a.hits)[0]!;
  const weakest = [...metrics].sort((a, b) => a.hits - b.hits || b.improvement - a.improvement)[0]!;
  const wentWell = best.improvement > 0
    ? `${labels[best.metric][0]!.toUpperCase()}${labels[best.metric].slice(1)} hit ${best.hits} days, up from ${before[best.metric]}.`
    : `${labels[best.metric][0]!.toUpperCase()}${labels[best.metric].slice(1)} led the week with ${best.hits} target days.`;

  const weekdaySteps = week.slice(0, 5).flatMap((day) => day.steps === null ? [] : [day.steps]);
  const weekendSteps = week.slice(5).flatMap((day) => day.steps === null ? [] : [day.steps]);
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const lowProteinDays = week.filter((day) => day.hasMealData && day.proteinGrams < 0.9 * day.proteinTargetGrams).length;
  const weekendCalorieOvers = week.slice(5).filter((day) => day.hasMealData && day.calories > day.calorieTarget).length;
  const allCalorieOvers = week.filter((day) => day.hasMealData && day.calories > day.calorieTarget).length;
  const pattern = weekdaySteps.length > 0 && weekendSteps.length > 0 && mean(weekendSteps) < mean(weekdaySteps) * 0.75
    ? "Weekend movement was more than 25% below weekdays."
    : lowProteinDays > 0
      ? `Protein was below its useful range on ${lowProteinDays} logged ${lowProteinDays === 1 ? "day" : "days"}.`
      : weekendCalorieOvers > 0 && weekendCalorieOvers >= allCalorieOvers / 2
        ? "Most calorie-over-target days landed on the weekend."
        : "Your strongest days were the ones with both a logged meal and some movement.";

  let focus: string;
  if (weakest.metric === "protein") {
    const mealDays = week.filter((day) => day.hasMealData);
    const averageGap = mealDays.length ? mean(mealDays.map((day) => Math.max(0, day.proteinTargetGrams - day.proteinGrams))) : 25;
    focus = `Add about ${Math.max(10, Math.round(averageGap / 5) * 5)} g of protein to breakfast on 4 days.`;
  } else if (weakest.metric === "movement") {
    focus = "Take a 15-minute walk after lunch on 4 weekdays, about 1,500 steps each time.";
  } else {
    focus = "Plan one balanced dinner before the busiest part of 4 days this week.";
  }

  const averageHits = (current.protein + current.movement + current.calories) / 3;
  const mood: KimboMood = averageHits >= 5 ? "happy" : averageHits >= 3 ? "playful" : "sad";
  return {
    key: `weekly:${week[0]!.date}`,
    type: "weekly-reflection",
    kind: "weekly",
    priority: 68,
    mood,
    topic: weakest.metric === "movement" ? "movement" : weakest.metric,
    title: "📈 Your week with Kimbo",
    explanation: `${wentWell} ${pattern}`,
    action: { label: "See my week", route: "/progress" },
    actionable: true,
    actionableUntil: 1320,
    wentWell,
    pattern,
    focus,
  };
}

export function selectNotification(
  insights: Insight[],
  ctx: { minute: number; sentToday: { key: string; kind: Insight["kind"]; minute: number }[] },
): Insight | null {
  if (ctx.minute < 480 || ctx.minute >= 1320) return null;
  const keys = new Set(ctx.sentToday.map((entry) => entry.key));
  const nudges = ctx.sentToday.filter((entry) => entry.kind === "nudge");
  const feedback = ctx.sentToday.filter((entry) => entry.kind === "feedback");
  const latestNudge = nudges.reduce((latest, entry) => Math.max(latest, entry.minute), Number.NEGATIVE_INFINITY);
  return insights.find((insight) => {
    if (!insight.actionable || keys.has(insight.key)) return false;
    if (insight.actionableUntil !== null && ctx.minute > insight.actionableUntil) return false;
    if (insight.kind === "nudge" && (nudges.length >= 2 || ctx.minute - latestNudge < 120)) return false;
    if (insight.kind === "feedback" && feedback.length >= 2) return false;
    return true;
  }) ?? null;
}
