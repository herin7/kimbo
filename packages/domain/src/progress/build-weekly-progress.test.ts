import type { DailyHealthSummary } from "@kimbo/contracts";
import { describe, expect, it } from "vitest";

import { buildWeeklyProgress } from "./build-weekly-progress.js";

const day = (date: string, overrides: Partial<DailyHealthSummary> = {}): DailyHealthSummary => ({
  date,
  calories: 0,
  calorieTarget: 2_000,
  proteinGrams: 0,
  proteinTargetGrams: 100,
  steps: null,
  stepTarget: 8_000,
  hasMealData: false,
  hasActivityData: false,
  ...overrides,
});

const week = Array.from({ length: 7 }, (_, index) => day(`2026-10-0${index + 1}`));

describe("buildWeeklyProgress", () => {
  it("returns a helpful empty-state insight", () => {
    const result = buildWeeklyProgress(week);
    expect(result.insight.facts.daysWithData).toBe(0);
    expect(result.insight.message).toContain("first weekly pattern");
  });

  it("uses only days with available data", () => {
    const result = buildWeeklyProgress([
      day("2026-10-01", { calories: 1_800, proteinGrams: 80, steps: 6_000, hasMealData: true, hasActivityData: true }),
      ...week.slice(1),
    ]);
    expect(result.adherence).toEqual({ caloriesPercent: 90, movementPercent: 75, proteinPercent: 80 });
    expect(result.insight.facts.averageStepGap).toBe(2_000);
    expect(result.insight.facts.estimatedWalkMinutes).toBe(20);
  });

  it("computes a full week without asking AI to derive facts", () => {
    const completeWeek = week.map((entry) => ({ ...entry, calories: 1_900, proteinGrams: 90, steps: 8_000, hasMealData: true, hasActivityData: true }));
    const result = buildWeeklyProgress(completeWeek);
    expect(result.insight.facts.daysWithinCalorieGoal).toBe(7);
    expect(result.insight.facts.weakestMetric).toBe("protein");
    expect(result.adherence.movementPercent).toBe(100);
  });

  it("keeps missing movement distinct from zero steps", () => {
    const result = buildWeeklyProgress(week.map((entry) => ({ ...entry, calories: 1_500, proteinGrams: 60, hasMealData: true })));
    expect(result.insight.facts.averageSteps).toBeNull();
    expect(result.adherence.movementPercent).toBe(0);
  });
});
