import { useMemo } from "react";

import { useActivitySessions, useTodaySteps } from "@/features/activity/hooks/activity.queries";
import { useMeals } from "@/features/meals/hooks/meal.queries";
import { useOnboardingStatus } from "@/features/onboarding";

import { buildLocalWeek } from "../domain/build-local-week";

export function useWeeklyProgress() {
  const goal = useOnboardingStatus();
  const meals = useMeals();
  const sessions = useActivitySessions();
  const steps = useTodaySteps();
  const data = useMemo(() => goal.data ? buildLocalWeek({ goal: goal.data, meals: meals.data ?? [], sessions: sessions.data ?? [], todaySteps: steps.data ?? 0 }) : null, [goal.data, meals.data, sessions.data, steps.data]);
  return { data, isLoading: goal.isLoading || meals.isLoading || sessions.isLoading || steps.isLoading };
}
