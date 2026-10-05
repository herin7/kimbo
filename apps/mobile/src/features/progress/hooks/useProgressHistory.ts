import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useActivitySessions, useTodaySteps } from "@/features/activity/hooks/activity.queries";
import { useMeals } from "@/features/meals/hooks/meal.queries";
import { useOnboardingStatus } from "@/features/onboarding";

import { mergeProgressHistory } from "../domain/build-progress-overview";
import { progressHistoryQueryKey, progressHistoryRepository } from "../storage/progress-history.repository";

export function useProgressHistory() {
  const stored = useQuery({ queryKey: progressHistoryQueryKey, queryFn: () => progressHistoryRepository.getSummaries(), staleTime: Number.POSITIVE_INFINITY });
  const goal = useOnboardingStatus();
  const meals = useMeals();
  const sessions = useActivitySessions();
  const steps = useTodaySteps();
  const data = useMemo(() => goal.data ? mergeProgressHistory({
    summaries: stored.data ?? [],
    goal: goal.data,
    meals: meals.data ?? [],
    sessions: sessions.data ?? [],
    todaySteps: steps.data ?? 0,
  }) : null, [goal.data, meals.data, sessions.data, steps.data, stored.data]);
  return { data, isLoading: stored.isLoading || goal.isLoading || meals.isLoading || sessions.isLoading || steps.isLoading };
}
