import {
  ConfirmedMealSchema,
  MealDraftSchema,
  type ConfirmedMeal,
  type MealDraft,
} from "@kimbo/contracts";
import Storage from "expo-sqlite/kv-store";
import { z } from "zod";

import { parseStoredJson } from "@/shared/storage/parse-stored-json";

const MEALS_KEY = "kimbo.meals.v1";
const MEAL_DRAFT_KEY = "kimbo.meal-draft.v1";
const MealsSchema = z.array(ConfirmedMealSchema);

export interface MealRepository {
  getMeals(): Promise<ConfirmedMeal[]>;
  saveMeal(meal: ConfirmedMeal): Promise<void>;
  getDraft(): Promise<MealDraft | null>;
  saveDraft(draft: MealDraft): Promise<void>;
  clearDraft(): Promise<void>;
  replaceMeals(meals: ConfirmedMeal[]): Promise<void>;
  clear(): Promise<void>;
}

class SQLiteMealRepository implements MealRepository {
  async getMeals(): Promise<ConfirmedMeal[]> {
    const stored = await Storage.getItem(MEALS_KEY);
    if (!stored) return [];
    const parsed = parseStoredJson(stored, MealsSchema);
    if (parsed) return parsed;
    await Storage.removeItem(MEALS_KEY);
    return [];
  }

  async saveMeal(meal: ConfirmedMeal): Promise<void> {
    const meals = await this.getMeals();
    const existingIndex = meals.findIndex((existing) => existing.id === meal.id);
    if (existingIndex >= 0) meals[existingIndex] = meal;
    else meals.push(meal);
    await Storage.setItem(MEALS_KEY, JSON.stringify(meals));
  }

  async getDraft(): Promise<MealDraft | null> {
    const stored = await Storage.getItem(MEAL_DRAFT_KEY);
    if (!stored) return null;
    const parsed = parseStoredJson(stored, MealDraftSchema);
    if (parsed) return parsed;
    await Storage.removeItem(MEAL_DRAFT_KEY);
    return null;
  }

  async saveDraft(draft: MealDraft): Promise<void> {
    await Storage.setItem(MEAL_DRAFT_KEY, JSON.stringify(draft));
  }

  async clearDraft(): Promise<void> {
    await Storage.removeItem(MEAL_DRAFT_KEY);
  }

  async replaceMeals(meals: ConfirmedMeal[]): Promise<void> {
    await Storage.setItem(MEALS_KEY, JSON.stringify(meals));
  }

  async clear(): Promise<void> {
    await Promise.all([Storage.removeItem(MEALS_KEY), Storage.removeItem(MEAL_DRAFT_KEY)]);
  }
}

export const mealRepository: MealRepository = new SQLiteMealRepository();
