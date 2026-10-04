import { type HealthGoal, type HealthGoalInput } from "@kimbo/contracts";
import { calculateHealthTargets } from "@kimbo/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { onboardingQueryKey } from "./useOnboardingStatus";
import { onboardingRepository } from "../storage/onboarding.repository";
import { syncGoal } from "@/shared/api/health-data.api";

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: HealthGoalInput): Promise<HealthGoal> => {
      const goal: HealthGoal = {
        ...input,
        ...calculateHealthTargets(input),
        updatedAt: new Date().toISOString(),
      };

      await onboardingRepository.saveHealthGoal(goal);
      return goal;
    },
    onSuccess: async (goal) => {
      queryClient.setQueryData(onboardingQueryKey, goal);
      void syncGoal(goal).catch(() => undefined);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
}
