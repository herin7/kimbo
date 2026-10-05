import { describe, expect, it } from "vitest";

import { assessMealQuality, deriveKimboReaction, type KimboDayInput } from "./kimbo-reactions.js";

const meal = (hoursAgo: number, now: Date, totals: { calories: number; proteinGrams: number; fatGrams: number }) => ({
  occurredAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  totals: { carbsGrams: 0, ...totals },
});

const day = (overrides: Partial<KimboDayInput> = {}): KimboDayInput => ({
  now: new Date("2026-10-04T06:30:00.000Z"),
  meals: [],
  calorieTarget: 2_000,
  proteinTargetGrams: 100,
  steps: 4_000,
  stepTarget: 8_000,
  isWalking: false,
  timeZone: "Asia/Calcutta",
  ...overrides,
});

describe("assessMealQuality", () => {
  it("rewards protein-forward plates and flags obvious imbalances", () => {
    expect(assessMealQuality({ calories: 400, proteinGrams: 35, carbsGrams: 30, fatGrams: 10 })).toBe("great");
    expect(assessMealQuality({ calories: 800, proteinGrams: 10, carbsGrams: 80, fatGrams: 45 })).toBe("poor");
    expect(assessMealQuality({ calories: 1_050, proteinGrams: 70, carbsGrams: 100, fatGrams: 35 })).toBe("heavy");
    expect(assessMealQuality({ calories: 500, proteinGrams: 20, carbsGrams: 70, fatGrams: 15 })).toBe("balanced");
  });
});

describe("deriveKimboReaction", () => {
  it("keeps a freshly saved meal ahead of scheduled coaching", () => {
    const now = new Date("2026-10-04T15:30:00.000Z");
    const reaction = deriveKimboReaction(day({ now, meals: [meal(0.1, now, { calories: 900, proteinGrams: 8, fatGrams: 55 })], steps: 0 }));
    expect(reaction).toMatchObject({ mood: "angry", topic: "meal" });
    expect(reaction.line).toContain("92 g");
  });

  it("reacts to whichever happened last: starting a walk or logging a meal", () => {
    const now = new Date("2026-10-04T15:30:00.000Z");
    const recentMeal = meal(0.1, now, { calories: 900, proteinGrams: 8, fatGrams: 55 });
    expect(deriveKimboReaction(day({ now, meals: [recentMeal], isWalking: true, walkingStartedAt: new Date(now.getTime() - 30_000).toISOString() }))).toMatchObject({ mood: "playful", topic: "walk" });
    expect(deriveKimboReaction(day({ now, meals: [meal(0.01, now, recentMeal.totals)], isWalking: true, walkingStartedAt: new Date(now.getTime() - 300_000).toISOString() }))).toMatchObject({ mood: "angry", topic: "meal" });
  });

  it("uses the shared coaching engine for the day's main gap", () => {
    const now = new Date("2026-10-04T13:30:00.000Z");
    const reaction = deriveKimboReaction(day({ now, steps: 1_000, meals: [meal(4, now, { calories: 700, proteinGrams: 20, fatGrams: 20 })] }));
    expect(["protein", "movement"]).toContain(reaction.topic);
    expect(["sad", "angry"]).toContain(reaction.mood);
  });

  it("falls back to a neutral morning before facts exist", () => {
    expect(deriveKimboReaction(day({ now: new Date("2026-10-04T02:30:00.000Z"), steps: 0 }))).toMatchObject({ mood: "neutral", topic: "breakfast" });
  });
});
