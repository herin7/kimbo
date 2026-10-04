import type { MealAnalysisResult, MealDraft, MealSource, MealType } from "@kimbo/contracts";
import * as Crypto from "expo-crypto";

export function createDraftFromAnalysis(
  analysis: MealAnalysisResult,
  source: Exclude<MealSource, "manual">,
  mealType: MealType,
): MealDraft {
  return {
    id: Crypto.randomUUID(),
    source,
    mealType,
    occurredAt: new Date().toISOString(),
    items: analysis.items.map((item) => ({ ...item, id: item.id ?? Crypto.randomUUID() })),
  };
}
