import { describe, expect, it } from "vitest";

import {
  assessMealQuality,
  deriveKimboReaction,
  planKimboNudges,
  reactToWeek,
  type KimboDayInput,
} from "./kimbo-reactions.js";

const meal = (hoursAgo: number, now: Date, totals: { calories: number; proteinGrams: number; fatGrams: number }) => ({
  occurredAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  totals: { carbsGrams: 0, ...totals },
});

const day = (overrides: Partial<KimboDayInput> = {}): KimboDayInput => ({
  now: new Date(2026, 9, 4, 12, 0),
  meals: [],
  calorieTarget: 2_000,
  proteinTargetGrams: 100,
  steps: 4_000,
  stepTarget: 8_000,
  isWalking: false,
  ...overrides,
});

describe("assessMealQuality", () => {
  it("rewards protein-forward plates and flags low-protein fatty ones", () => {
    expect(assessMealQuality({ calories: 400, proteinGrams: 35, carbsGrams: 30, fatGrams: 10 })).toBe("great");
    expect(assessMealQuality({ calories: 800, proteinGrams: 10, carbsGrams: 80, fatGrams: 45 })).toBe("poor");
    expect(assessMealQuality({ calories: 950, proteinGrams: 30, carbsGrams: 120, fatGrams: 35 })).toBe("heavy");
    expect(assessMealQuality({ calories: 500, proteinGrams: 20, carbsGrams: 70, fatGrams: 15 })).toBe("balanced");
    expect(assessMealQuality({ calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 })).toBe("balanced");
  });
});

describe("deriveKimboReaction", () => {
  it("reacts to a meal logged in the last 20 minutes before anything else", () => {
    const now = new Date(2026, 9, 4, 21, 0);
    const junk = meal(0.1, now, { calories: 900, proteinGrams: 8, fatGrams: 55 });
    const reaction = deriveKimboReaction(day({ now, meals: [junk], steps: 0 }));
    expect(reaction).toMatchObject({ mood: "angry", topic: "meal" });
    expect(reaction.line).toContain("92 g");
  });

  it("is happy about a protein-packed meal", () => {
    const now = new Date(2026, 9, 4, 13, 0);
    expect(deriveKimboReaction(day({ now, meals: [meal(0.05, now, { calories: 450, proteinGrams: 40, fatGrams: 12 })] })).mood).toBe("happy");
  });

  it("cheers during a walk and celebrates finished goals", () => {
    expect(deriveKimboReaction(day({ isWalking: true })).mood).toBe("playful");
    const now = new Date(2026, 9, 4, 19, 0);
    const done = deriveKimboReaction(day({ now, steps: 9_000, meals: [meal(5, now, { calories: 1_500, proteinGrams: 95, fatGrams: 40 })] }));
    expect(done).toMatchObject({ mood: "happy", topic: "goals" });
  });

  it("gets angry in the evening when protein or movement is uncovered", () => {
    const now = new Date(2026, 9, 4, 19, 0);
    const lowProtein = deriveKimboReaction(day({ now, steps: 9_000, meals: [meal(4, now, { calories: 1_200, proteinGrams: 30, fatGrams: 40 })] }));
    expect(lowProtein).toMatchObject({ mood: "angry", topic: "protein" });
    expect(lowProtein.line).toMatch(/Who's covering today's protein/);
    const lazy = deriveKimboReaction(day({ now, steps: 1_200, meals: [meal(4, now, { calories: 1_200, proteinGrams: 90, fatGrams: 40 })] }));
    expect(lazy).toMatchObject({ mood: "angry", topic: "movement" });
  });

  it("is sad when nothing has been eaten by late morning, neutral before", () => {
    expect(deriveKimboReaction(day({ now: new Date(2026, 9, 4, 12, 0) })).mood).toBe("sad");
    expect(deriveKimboReaction(day({ now: new Date(2026, 9, 4, 8, 0), steps: 0 })).mood).toBe("neutral");
  });

  it("is sad about going well over the calorie target", () => {
    const now = new Date(2026, 9, 4, 16, 0);
    expect(deriveKimboReaction(day({ now, meals: [meal(3, now, { calories: 2_400, proteinGrams: 90, fatGrams: 60 })] })).topic).toBe("calories");
  });
});

describe("reactToWeek", () => {
  const week = { daysWithData: 5, caloriesPercent: 60, movementPercent: 60, proteinPercent: 60, weakestMetric: "protein" as const };

  it("celebrates strong weeks and nudges the weakest habit otherwise", () => {
    expect(reactToWeek({ ...week, caloriesPercent: 90, movementPercent: 80, proteinPercent: 80 }).mood).toBe("happy");
    expect(reactToWeek(week)).toMatchObject({ mood: "playful" });
    expect(reactToWeek({ ...week, caloriesPercent: 30, movementPercent: 40, proteinPercent: 20 })).toMatchObject({ mood: "angry", topic: "protein" });
    expect(reactToWeek({ ...week, daysWithData: 0 }).mood).toBe("neutral");
  });
});

describe("planKimboNudges", () => {
  it("only schedules future check-ins for gaps that are still open", () => {
    const now = new Date(2026, 9, 4, 12, 0);
    const ids = planKimboNudges(day({ now, steps: 2_000 })).map((nudge) => nudge.id);
    expect(ids).toEqual(["protein-lunch", "movement", "protein-dinner"]);
  });

  it("asks who will cover protein at dinner and stays quiet once goals are met", () => {
    const now = new Date(2026, 9, 4, 18, 0);
    const open = planKimboNudges(day({ now, meals: [meal(5, now, { calories: 900, proteinGrams: 20, fatGrams: 20 })] }));
    expect(open.map((nudge) => nudge.title)).toContain("Who will cover today's protein?");
    const met = planKimboNudges(day({ now, steps: 9_000, meals: [meal(5, now, { calories: 1_500, proteinGrams: 100, fatGrams: 40 })] }));
    expect(met).toEqual([]);
  });
});
