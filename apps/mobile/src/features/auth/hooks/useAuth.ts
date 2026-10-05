import type { AuthSession, LoginRequest, LoginResponse } from "@kimbo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { activeSessionQueryKey, activitySessionsQueryKey, todayStepsQueryKey } from "@/features/activity/hooks/activity.queries";
import { activityRepository } from "@/features/activity/storage/activity.repository";
import { mealsQueryKey } from "@/features/meals/hooks/meal.queries";
import { mealRepository } from "@/features/meals/storage/meal.repository";
import { onboardingQueryKey } from "@/features/onboarding/hooks/useOnboardingStatus";
import { onboardingRepository } from "@/features/onboarding/storage/onboarding.repository";
import { progressHistoryQueryKey, progressHistoryRepository } from "@/features/progress/storage/progress-history.repository";
import KimboActivityModule from "../../../../modules/live-update";
import { clearAuthSession, getAuthSession, saveAuthSession } from "@/shared/storage/identity.repository";

import { fetchAccountSnapshot, login } from "../api/auth.api";

export const authSessionQueryKey = ["auth-session"] as const;

export function useAuthSession() {
  return useQuery({ queryKey: authSessionQueryKey, queryFn: getAuthSession, staleTime: Number.POSITIVE_INFINITY });
}

async function persistLogin(result: LoginResponse) {
  const session: AuthSession = { token: result.token, user: result.user };
  await Promise.all([
    saveAuthSession(session),
    onboardingRepository.saveHealthGoal(result.goal),
    mealRepository.replaceMeals(result.meals),
    activityRepository.replaceSessions(result.activitySessions),
    progressHistoryRepository.replaceSummaries(result.dailySummaries),
  ]);
  return { result, session };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginRequest) => login(input).then(persistLogin),
    onSuccess: ({ result, session }) => {
      queryClient.setQueryData(authSessionQueryKey, session);
      queryClient.setQueryData(onboardingQueryKey, result.goal);
      queryClient.setQueryData(mealsQueryKey, result.meals);
      queryClient.setQueryData(activitySessionsQueryKey, result.activitySessions);
      queryClient.setQueryData(progressHistoryQueryKey, result.dailySummaries);
      queryClient.setQueryData(activeSessionQueryKey, result.activitySessions.find((item) => item.state === "active") ?? null);
    },
  });
}

export function useRefreshAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!(await getAuthSession())) return null;
      const snapshot = await fetchAccountSnapshot();
      const [savedMeals, savedSessions] = await Promise.all([
        mealRepository.getMeals(),
        activityRepository.getSessions(),
      ]);
      const mealIds = new Set(snapshot.meals.map((meal) => meal.id));
      const sessionIds = new Set(snapshot.activitySessions.map((session) => session.id));
      const meals = [...snapshot.meals, ...savedMeals.filter((meal) => meal.syncStatus !== "synced" && !mealIds.has(meal.id))];
      const activitySessions = [...snapshot.activitySessions, ...savedSessions.filter((session) => session.syncStatus !== "synced" && !sessionIds.has(session.id))];
      await Promise.all([
        onboardingRepository.saveHealthGoal(snapshot.goal),
        mealRepository.replaceMeals(meals),
        activityRepository.replaceSessions(activitySessions),
        progressHistoryRepository.replaceSummaries(snapshot.dailySummaries),
      ]);
      return { ...snapshot, meals, activitySessions };
    },
    onSuccess: async (snapshot) => {
      if (!snapshot) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: onboardingQueryKey }),
          queryClient.invalidateQueries({ queryKey: mealsQueryKey }),
          queryClient.invalidateQueries({ queryKey: activitySessionsQueryKey }),
          queryClient.invalidateQueries({ queryKey: progressHistoryQueryKey }),
          queryClient.invalidateQueries({ queryKey: todayStepsQueryKey }),
        ]);
        return;
      }
      queryClient.setQueryData(onboardingQueryKey, snapshot.goal);
      queryClient.setQueryData(mealsQueryKey, snapshot.meals);
      queryClient.setQueryData(activitySessionsQueryKey, snapshot.activitySessions);
      queryClient.setQueryData(progressHistoryQueryKey, snapshot.dailySummaries);
      queryClient.setQueryData(activeSessionQueryKey, snapshot.activitySessions.find((item) => item.state === "active") ?? null);
      await queryClient.invalidateQueries({ queryKey: todayStepsQueryKey });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // The Android island and its snapshot survive the JS process. Clear them before removing
      // this account so an idle island cannot continue showing the previous user's data.
      try {
        KimboActivityModule?.clearIslandState();
      } catch (error) {
        console.warn("Kimbo: couldn't clear island state on logout", error);
      }
      await Promise.all([
        clearAuthSession(),
        onboardingRepository.clearHealthGoal(),
        mealRepository.clear(),
        activityRepository.clear(),
        progressHistoryRepository.clear(),
      ]);
    },
    onSuccess: () => queryClient.clear(),
  });
}
