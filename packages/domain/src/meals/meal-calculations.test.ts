import type { MealItem } from "@kimbo/contracts";
import { describe, expect, it } from "vitest";

import { sumNutrition, updateMealItemQuantity } from "./meal-calculations.js";

const item: MealItem = {
  name: "Roti",
  portion: { amount: 2, unit: "pieces", displayText: "2 pieces" },
  nutrition: { calories: 200, proteinGrams: 6, carbsGrams: 40, fatGrams: 2 },
  confidence: 1,
};

describe("meal calculations", () => {
  it("sums nutrition totals", () => {
    expect(sumNutrition([item, item])).toEqual({
      calories: 400,
      proteinGrams: 12,
      carbsGrams: 80,
      fatGrams: 4,
    });
  });

  it("scales nutrition when quantity changes", () => {
    expect(updateMealItemQuantity(item, 1).nutrition).toEqual({
      calories: 100,
      proteinGrams: 3,
      carbsGrams: 20,
      fatGrams: 1,
    });
  });

  it("ignores invalid quantities", () => {
    expect(updateMealItemQuantity(item, 0)).toBe(item);
  });
});
