import type { ActivitySession, ConfirmedMeal, DailyHealthSummary, HealthGoal } from "@kimbo/contracts";
import { buildWeeklyProgress } from "@kimbo/domain";

const toLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function buildLocalWeek(input: { goal: HealthGoal; meals: ConfirmedMeal[]; sessions: ActivitySession[]; todaySteps: number; now?: Date }) {
  const now = input.now ?? new Date();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const todayKey = toLocalDate(now);
  const days: DailyHealthSummary[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = toLocalDate(date);
    const meals = input.meals.filter((meal) => toLocalDate(new Date(meal.occurredAt)) === key);
    const sessions = input.sessions.filter((session) => toLocalDate(new Date(session.startedAt)) === key);
    const sessionSteps = sessions.reduce<number | null>((highest, session) => {
      const steps = session.endingSteps ?? session.currentSteps;
      return highest === null ? steps : Math.max(highest, steps);
    }, null);
    const steps = key === todayKey ? input.todaySteps : sessionSteps;
    return {
      date: key,
      calories: Math.round(meals.reduce((sum, meal) => sum + meal.totals.calories, 0)),
      calorieTarget: input.goal.dailyCalorieTarget,
      proteinGrams: meals.reduce((sum, meal) => sum + meal.totals.proteinGrams, 0),
      proteinTargetGrams: input.goal.dailyProteinTargetGrams,
      steps,
      stepTarget: input.goal.dailyStepTarget,
      hasMealData: meals.length > 0,
      hasActivityData: steps !== null,
    };
  });
  return buildWeeklyProgress(days);
}
