import type { DailyHealthSummary, InsightFacts, WeeklyProgress } from "@kimbo/contracts";

const average = (values: number[]) => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
const percent = (values: number[]) => Math.round(Math.min(1, average(values)) * 100);

export function buildWeeklyProgress(days: DailyHealthSummary[]): WeeklyProgress {
  if (days.length !== 7) throw new Error("Weekly progress requires exactly seven days");

  const mealDays = days.filter((day) => day.hasMealData);
  const movementDays = days.filter((day) => day.hasActivityData && day.steps !== null);
  const caloriesPercent = percent(mealDays.map((day) => day.calories / day.calorieTarget));
  const proteinPercent = percent(mealDays.map((day) => day.proteinGrams / day.proteinTargetGrams));
  const movementPercent = percent(movementDays.map((day) => (day.steps ?? 0) / day.stepTarget));
  const averageSteps = movementDays.length > 0 ? Math.round(average(movementDays.map((day) => day.steps ?? 0))) : null;
  const averageStepTarget = movementDays.length > 0 ? Math.round(average(movementDays.map((day) => day.stepTarget))) : null;
  const averageStepGap = averageSteps !== null && averageStepTarget !== null ? Math.max(0, averageStepTarget - averageSteps) : null;
  const estimatedWalkMinutes = averageStepGap === null ? null : Math.ceil(averageStepGap / 100);
  const scores = [
    { metric: "calories" as const, score: mealDays.length > 0 ? caloriesPercent : null },
    { metric: "movement" as const, score: movementDays.length > 0 ? movementPercent : null },
    { metric: "protein" as const, score: mealDays.length > 0 ? proteinPercent : null },
  ].filter((entry): entry is { metric: "calories" | "movement" | "protein"; score: number } => entry.score !== null);
  const weakestMetric = scores.length > 0 ? scores.reduce((weakest, entry) => entry.score < weakest.score ? entry : weakest).metric : null;

  const facts: InsightFacts = {
    daysWithData: days.filter((day) => day.hasMealData || day.hasActivityData).length,
    daysWithinCalorieGoal: mealDays.filter((day) => day.calories <= day.calorieTarget).length,
    averageSteps,
    averageStepGap,
    estimatedWalkMinutes,
    weakestMetric,
  };

  return {
    weekStart: days[0]!.date,
    weekEnd: days[6]!.date,
    days,
    adherence: { caloriesPercent, movementPercent, proteinPercent },
    insight: { facts, message: buildInsightMessage(facts, mealDays.length, movementDays.length) },
  };
}

function buildInsightMessage(facts: InsightFacts, mealDays: number, movementDays: number): string {
  if (facts.daysWithData === 0) return "Log a meal or start an activity to create your first weekly pattern.";
  const parts: string[] = [];
  if (mealDays > 0) parts.push(`You stayed within your calorie goal on ${facts.daysWithinCalorieGoal} of ${mealDays} logged ${mealDays === 1 ? "day" : "days"}.`);
  if (movementDays > 0 && facts.averageSteps !== null && facts.averageStepGap !== null) {
    if (facts.averageStepGap === 0) parts.push(`Movement is on target at an average of ${facts.averageSteps.toLocaleString("en-IN")} steps.`);
    else parts.push(`Movement is the clearest opportunity: you’re averaging ${facts.averageSteps.toLocaleString("en-IN")} steps, ${facts.averageStepGap.toLocaleString("en-IN")} below target. A ${facts.estimatedWalkMinutes}-minute walk would close most of that gap.`);
  } else {
    parts.push("Start one walking activity to add movement to this week’s picture.");
  }
  return parts.join(" ");
}
