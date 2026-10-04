import { reactToMeal, sumNutrition } from "@kimbo/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import KimboActivityModule, { type IslandMeal } from "../../../../modules/live-update";
import type { KimboDay } from "@/features/kimbo/hooks/useKimboDay";
import { KimboApiError } from "@/shared/api/api-client";
import { mapAppErrorToMessage } from "@/shared/errors/AppError";

import { analyseTextMeal, transcribeMeal } from "../api/meal.api";
import { getDefaultMealType } from "../domain/meal.defaults";
import { createDraftFromAnalysis } from "../domain/meal-draft";
import { mealRepository } from "../storage/meal.repository";
import { mealDraftQueryKey, useSaveMeal, useSaveMealDraft } from "./meal.queries";

const show = (meal: IslandMeal) => KimboActivityModule?.setIslandMeal(meal);
const summary = (calories: number, protein: number) => `${Math.round(calories)} kcal · ${Math.round(protein)} g protein`;

/**
 * Lets the island finish a whole voice log without opening the app: the island records, and this
 * runs the same pipeline as the voice screen (transcribe, analyse, draft) and the same save as
 * "Looks right", reporting each step back to the island.
 */
export function useIslandMealLogging(day: KimboDay | null) {
  const queryClient = useQueryClient();
  const saveDraft = useSaveMealDraft();
  const saveMeal = useSaveMeal();
  const latestDay = useRef(day);
  useEffect(() => {
    latestDay.current = day;
  });

  const handleVoice = useCallback(async (uri: string) => {
    try {
      const { transcript } = await transcribeMeal(uri);
      show({ phase: "processing", title: "Kimbo is thinking…", detail: `“${transcript}”` });
      const analysis = await analyseTextMeal(transcript);
      const draft = createDraftFromAnalysis(analysis, "voice", getDefaultMealType());
      await saveDraft.mutateAsync(draft);
      const totals = sumNutrition(draft.items);
      const today = latestDay.current;
      const proteinLeft = today ? today.goal.dailyProteinTargetGrams - today.protein - totals.proteinGrams : 0;
      const kimbo = reactToMeal(totals, Math.max(0, proteinLeft));
      show({
        phase: "review",
        title: draft.items.map((item) => item.name).join(", "),
        detail: summary(totals.calories, totals.proteinGrams),
        line: kimbo.line,
        mood: kimbo.mood,
      });
    } catch (error) {
      show({
        phase: "error",
        title: "Kimbo couldn't get that",
        detail: error instanceof KimboApiError ? mapAppErrorToMessage(error.appError) : "Try again, or open Kimbo to type it in.",
        mood: "sad",
      });
    }
  }, [saveDraft]);

  const handleSave = useCallback(async () => {
    const draft = await mealRepository.getDraft();
    if (!draft) {
      show({ phase: "error", title: "Nothing to save", detail: "That meal was already saved or discarded." });
      return;
    }
    const totals = sumNutrition(draft.items);
    await saveMeal.mutateAsync({
      ...draft,
      totals,
      syncStatus: "pending",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    show({ phase: "saved", title: "Saved to today", detail: summary(totals.calories, totals.proteinGrams), line: "Logged! I'll keep count.", mood: "happy" });
  }, [saveMeal]);

  const handleDiscard = useCallback(async () => {
    await mealRepository.clearDraft();
    queryClient.setQueryData(mealDraftQueryKey, null);
  }, [queryClient]);

  return { handleDiscard, handleSave, handleVoice };
}
