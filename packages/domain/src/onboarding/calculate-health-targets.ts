import type { ActivityLevel, GoalType, HealthGoalInput } from "@kimbo/contracts";

export interface EstimatedHealthTargets {
  dailyCalorieTarget: number;
  dailyProteinTargetGrams: number;
  dailyStepTarget: number;
}

const caloriesPerKilogram: Record<ActivityLevel, number> = {
  sedentary: 28,
  light: 30,
  moderate: 33,
  very_active: 36,
};

const calorieAdjustment: Record<GoalType, number> = {
  lose: -300,
  maintain: 0,
  gain: 250,
};

const proteinPerKilogram: Record<GoalType, number> = {
  lose: 1.3,
  maintain: 1.1,
  gain: 1.4,
};

const stepTargets: Record<ActivityLevel, number> = {
  sedentary: 7_000,
  light: 8_000,
  moderate: 9_000,
  very_active: 10_000,
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const roundTo = (value: number, interval: number) =>
  Math.round(value / interval) * interval;

export function calculateHealthTargets(
  input: HealthGoalInput,
): EstimatedHealthTargets {
  const maintenanceEstimate =
    input.currentWeightKg * caloriesPerKilogram[input.activityLevel];
  const calorieTarget =
    maintenanceEstimate + calorieAdjustment[input.goalType];
  const proteinTarget =
    input.currentWeightKg * proteinPerKilogram[input.goalType];

  return {
    dailyCalorieTarget: clamp(roundTo(calorieTarget, 50), 1_400, 4_500),
    dailyProteinTargetGrams: clamp(Math.round(proteinTarget), 50, 220),
    dailyStepTarget: stepTargets[input.activityLevel],
  };
}
