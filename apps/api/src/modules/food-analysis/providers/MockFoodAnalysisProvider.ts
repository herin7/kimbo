import type { MealAnalysisResult } from "@kimbo/contracts";

import type {
  AnalyseFoodImageInput,
  AnalyseFoodTextInput,
  FoodAnalysisProvider,
} from "../FoodAnalysisProvider.js";

const mockResult: MealAnalysisResult = {
  items: [
    {
      name: "2 rotis",
      portion: { amount: 2, unit: "pieces", displayText: "2 rotis" },
      nutrition: { calories: 210, proteinGrams: 6, carbsGrams: 42, fatGrams: 3 },
      confidence: 0.92,
    },
    {
      name: "Paneer sabzi",
      portion: { amount: 1, unit: "bowl", displayText: "1 medium bowl" },
      nutrition: { calories: 340, proteinGrams: 18, carbsGrams: 13, fatGrams: 24 },
      confidence: 0.72,
    },
  ],
  overallConfidence: 0.78,
  warnings: ["The paneer portion is an estimate."],
};

export class MockFoodAnalysisProvider implements FoodAnalysisProvider {
  async analyseText(_input: AnalyseFoodTextInput) {
    return mockResult;
  }

  async analyseImage(_input: AnalyseFoodImageInput) {
    return mockResult;
  }
}
