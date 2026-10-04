import type { ConfirmedMeal, MealDraft } from "@kimbo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mealRepository } from "../storage/meal.repository";
import { syncMeal } from "@/shared/api/health-data.api";

export const mealsQueryKey = ["meals"] as const;
export const mealDraftQueryKey = ["meal-draft"] as const;

export const useMeals = () => useQuery({
  queryKey: mealsQueryKey,
  queryFn: () => mealRepository.getMeals(),
  staleTime: Number.POSITIVE_INFINITY,
});

export const useMealDraft = () => useQuery({
  queryKey: mealDraftQueryKey,
  queryFn: () => mealRepository.getDraft(),
  staleTime: Number.POSITIVE_INFINITY,
});

export function useSaveMealDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: MealDraft) => mealRepository.saveDraft(draft),
    onSuccess: (_, draft) => queryClient.setQueryData(mealDraftQueryKey, draft),
  });
}

export function useSaveMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meal: ConfirmedMeal) => mealRepository.saveMeal(meal),
    onSuccess: async (_, meal) => {
      await mealRepository.clearDraft();
      queryClient.setQueryData(mealDraftQueryKey, null);
      await queryClient.invalidateQueries({ queryKey: mealsQueryKey });
      void syncMeal(meal).then(async (synced) => {
        await mealRepository.saveMeal(synced);
        await queryClient.invalidateQueries({ queryKey: mealsQueryKey });
      }).catch(() => undefined);
    },
  });
}
