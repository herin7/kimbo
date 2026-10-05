import { coachingDayFrom, deriveKimboReaction, evaluateDay, type Insight, type KimboDayInput, type KimboReaction } from "@kimbo/domain";
import type { ActivitySession, ConfirmedMeal, HealthGoal } from "@kimbo/contracts";
import { useEffect, useMemo, useState } from "react";

import { useActiveSession, useTodaySteps } from "@/features/activity/hooks/activity.queries";
import { useMeals } from "@/features/meals/hooks/meal.queries";
import { useOnboardingStatus } from "@/features/onboarding";
import { useProgressHistory } from "@/features/progress/hooks/useProgressHistory";

export interface KimboDay {
  goal: HealthGoal;
  todaysMeals: ConfirmedMeal[];
  calories: number;
  protein: number;
  steps: number;
  session: ActivitySession | null;
  input: KimboDayInput;
  reaction: KimboReaction;
  insight: Insight | null;
}

/** Re-evaluate once a minute so time-of-day moods (lunch, evening) move without new data. */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Today's health picture plus Kimbo's take on it. Null until onboarding exists. */
export function useKimboDay(): KimboDay | null {
  const now = useMinuteClock();
  const { data: goal } = useOnboardingStatus();
  const { data: meals = [] } = useMeals();
  const { data: steps = 0 } = useTodaySteps();
  const { data: session = null } = useActiveSession();
  const progressHistory = useProgressHistory();

  // Meals are the whole history: re-filter only when they or the date change, not every tick.
  const today = now.toDateString();
  const todays = useMemo(() => {
    const todaysMeals = meals.filter((meal) => new Date(meal.occurredAt).toDateString() === today);
    return {
      todaysMeals,
      calories: Math.round(todaysMeals.reduce((total, meal) => total + meal.totals.calories, 0)),
      protein: Math.round(todaysMeals.reduce((total, meal) => total + meal.totals.proteinGrams, 0)),
    };
  }, [meals, today]);

  return useMemo(() => {
    if (!goal) return null;
    const history = progressHistory.data ?? [];
    const { todaysMeals } = todays;
    const input: KimboDayInput = {
      now,
      meals: todaysMeals,
      calorieTarget: goal.dailyCalorieTarget,
      proteinTargetGrams: goal.dailyProteinTargetGrams,
      steps,
      stepTarget: goal.dailyStepTarget,
      isWalking: Boolean(session),
      walkingStartedAt: session?.startedAt ?? null,
      timeZone: goal.timeZone,
    };
    const reaction = deriveKimboReaction(input, history);
    const candidate = evaluateDay(coachingDayFrom(input, history))[0] ?? null;
    const insight = candidate && candidate.mood === reaction.mood && candidate.topic === reaction.topic ? candidate : null;
    return {
      goal,
      ...todays,
      steps,
      session,
      input,
      reaction,
      insight,
    };
  }, [goal, now, progressHistory.data, session, steps, todays]);
}
