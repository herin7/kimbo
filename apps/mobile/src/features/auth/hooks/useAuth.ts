import type { AuthSession, LoginRequest, LoginResponse } from "@kimbo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { activeSessionQueryKey, activitySessionsQueryKey } from "@/features/activity/hooks/activity.queries";
import { activityRepository } from "@/features/activity/storage/activity.repository";
import { mealsQueryKey } from "@/features/meals/hooks/meal.queries";
import { mealRepository } from "@/features/meals/storage/meal.repository";
import { onboardingQueryKey } from "@/features/onboarding/hooks/useOnboardingStatus";
import { onboardingRepository } from "@/features/onboarding/storage/onboarding.repository";
import { clearAuthSession, getAuthSession, saveAuthSession } from "@/shared/storage/identity.repository";

import { login } from "../api/auth.api";

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
      queryClient.setQueryData(activeSessionQueryKey, result.activitySessions.find((item) => item.state === "active") ?? null);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await Promise.all([
        clearAuthSession(),
        onboardingRepository.clearHealthGoal(),
        mealRepository.clear(),
        activityRepository.clear(),
      ]);
    },
    onSuccess: () => queryClient.clear(),
  });
}
