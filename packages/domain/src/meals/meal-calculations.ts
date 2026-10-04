import type { MealItem, Nutrition } from "@kimbo/contracts";

const roundOne = (value: number) => Math.round(value * 10) / 10;

export function sumNutrition(items: MealItem[]): Nutrition {
  return items.reduce<Nutrition>(
    (total, item) => ({
      calories: roundOne(total.calories + item.nutrition.calories),
      proteinGrams: roundOne(total.proteinGrams + item.nutrition.proteinGrams),
      carbsGrams: roundOne(total.carbsGrams + item.nutrition.carbsGrams),
      fatGrams: roundOne(total.fatGrams + item.nutrition.fatGrams),
    }),
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 },
  );
}

export function updateMealItemQuantity(item: MealItem, amount: number): MealItem {
  if (!Number.isFinite(amount) || amount <= 0) return item;

  const ratio = amount / item.portion.amount;
  return {
    ...item,
    portion: {
      ...item.portion,
      amount,
      displayText: `${amount} ${item.portion.unit}`,
    },
    nutrition: {
      calories: roundOne(item.nutrition.calories * ratio),
      proteinGrams: roundOne(item.nutrition.proteinGrams * ratio),
      carbsGrams: roundOne(item.nutrition.carbsGrams * ratio),
      fatGrams: roundOne(item.nutrition.fatGrams * ratio),
    },
  };
}
