import { useQuery } from "@tanstack/react-query";

import { onboardingRepository } from "../storage/onboarding.repository";

export const onboardingQueryKey = ["health-goal"] as const;

export function useOnboardingStatus() {
  return useQuery({
    queryKey: onboardingQueryKey,
    queryFn: () => onboardingRepository.getHealthGoal(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
