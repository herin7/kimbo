import { describe, expect, it } from "vitest";

import { calculateHealthTargets } from "./calculate-health-targets.js";

const baseInput = {
  currentWeightKg: 70,
  targetWeightKg: 65,
  heightCm: 175,
  ageYears: 30,
  activityLevel: "light" as const,
  timeZone: "Asia/Kolkata",
};

describe("calculateHealthTargets", () => {
  it("uses a conservative deficit for weight loss", () => {
    expect(calculateHealthTargets({ ...baseInput, goalType: "lose" })).toEqual({
      dailyCalorieTarget: 1_800,
      dailyProteinTargetGrams: 91,
      dailyStepTarget: 8_000,
    });
  });

  it("increases the calorie and protein target for weight gain", () => {
    const result = calculateHealthTargets({
      ...baseInput,
      goalType: "gain",
      targetWeightKg: 75,
    });

    expect(result.dailyCalorieTarget).toBe(2_350);
    expect(result.dailyProteinTargetGrams).toBe(98);
  });

  it("keeps targets inside intentionally conservative bounds", () => {
    const result = calculateHealthTargets({
      ...baseInput,
      currentWeightKg: 30,
      targetWeightKg: 29,
      goalType: "lose",
      activityLevel: "sedentary",
    });

    expect(result.dailyCalorieTarget).toBe(1_400);
    expect(result.dailyProteinTargetGrams).toBe(50);
  });
});
