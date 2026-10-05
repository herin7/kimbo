import type { DailyHealthSummary } from "@kimbo/contracts";
import { describe, expect, it } from "vitest";

import { buildWeeklyReflection, evaluateDay, localClock, selectNotification, type CoachingDay, type Insight } from "./coaching.js";

const summary = (date: string, overrides: Partial<DailyHealthSummary> = {}): DailyHealthSummary => ({
  date,
  calories: 1_900,
  calorieTarget: 2_000,
  proteinGrams: 100,
  proteinTargetGrams: 100,
  steps: 8_000,
  stepTarget: 8_000,
  hasMealData: true,
  hasActivityData: true,
  ...overrides,
});

const day = (overrides: Partial<CoachingDay> = {}): CoachingDay => ({
  date: "2026-10-05",
  minute: 12 * 60,
  weekday: 1,
  calorieTarget: 2_000,
  proteinTargetGrams: 100,
  stepTarget: 8_000,
  meals: [{ minute: 540, calories: 400, proteinGrams: 10 }],
  steps: 1_000,
  history: [],
  sentToday: [],
  ...overrides,
});

const ofType = (input: CoachingDay, type: Insight["type"]) => evaluateDay(input).find((insight) => insight.type === type);

describe("localClock", () => {
  it("uses the supplied timezone rather than the server clock", () => {
    expect(localClock(new Date("2026-10-05T14:30:00.000Z"), "Asia/Calcutta")).toEqual({ date: "2026-10-05", minute: 1_200, weekday: 1 });
    expect(localClock(new Date("2026-10-05T01:30:00.000Z"), "America/New_York")).toEqual({ date: "2026-10-04", minute: 1_290, weekday: 0 });
  });
});

describe("evaluateDay", () => {
  it("fires protein-behind only after a meal and late morning", () => {
    expect(ofType(day(), "protein-behind")).toBeDefined();
    expect(ofType(day({ meals: [] }), "protein-behind")).toBeUndefined();
    expect(ofType(day({ minute: 650 }), "protein-behind")).toBeUndefined();
  });

  it("keeps an unrecoverable protein gap visible but not pushable", () => {
    const insight = ofType(day({ minute: 1_100, proteinTargetGrams: 200, meals: [{ minute: 700, calories: 500, proteinGrams: 20 }] }), "protein-behind");
    expect(insight).toMatchObject({ actionable: false });
    expect(insight?.explanation).toContain("too large to chase");
  });

  it("fires calories-fast without shaming copy and stops after 17:00", () => {
    const insight = ofType(day({ minute: 960, meals: [{ minute: 900, calories: 1_950, proteinGrams: 60 }] }), "calories-fast");
    expect(insight?.action.label).toContain("lighter dinner");
    expect(insight?.explanation).not.toMatch(/too much|bad|guilt/i);
    expect(ofType(day({ minute: 1_020, meals: [{ minute: 900, calories: 1_800, proteinGrams: 60 }] }), "calories-fast")).toBeUndefined();
  });

  it("fires steps-behind only with current step data", () => {
    const insight = ofType(day({ history: [summary("2026-10-02", { steps: 6_000 }), summary("2026-10-03", { steps: 7_000 }), summary("2026-10-04", { steps: 8_000 })] }), "steps-behind");
    expect(insight?.explanation).toContain("usually have");
    expect(ofType(day({ steps: null }), "steps-behind")).toBeUndefined();
  });

  it("fires back-on-track only after the matching nudge was sent", () => {
    const caughtUp = day({ meals: [{ minute: 540, calories: 700, proteinGrams: 55 }], sentToday: ["protein-behind:2026-10-05"] });
    expect(ofType(caughtUp, "back-on-track")).toMatchObject({ mood: "happy", kind: "feedback" });
    expect(ofType({ ...caughtUp, sentToday: [] }, "back-on-track")).toBeUndefined();
  });

  it("fires one or combined goal-achieved feedback", () => {
    expect(ofType(day({ meals: [{ minute: 600, calories: 1_500, proteinGrams: 100 }], steps: 2_000 }), "goal-achieved")?.key).toContain(":protein:");
    expect(ofType(day({ meals: [{ minute: 600, calories: 1_500, proteinGrams: 100 }], steps: 8_000 }), "goal-achieved")).toMatchObject({ priority: 85, mood: "playful" });
    expect(ofType(day({ meals: [{ minute: 600, calories: 500, proteinGrams: 20 }], steps: 2_000 }), "goal-achieved")).toBeUndefined();
  });
});

describe("buildWeeklyReflection", () => {
  it("summarizes what worked, the strongest pattern, and one concrete focus", () => {
    const week = Array.from({ length: 7 }, (_, index) => summary(`2026-09-${String(28 + index).padStart(2, "0")}`, index >= 5 ? { steps: 4_000, proteinGrams: 60 } : {}));
    const previous = Array.from({ length: 7 }, (_, index) => summary(`2026-09-${String(21 + index).padStart(2, "0")}`, { proteinGrams: 50 }));
    const insight = buildWeeklyReflection(week, previous);
    expect(insight).toMatchObject({ type: "weekly-reflection", kind: "weekly", actionable: true });
    expect(insight.wentWell).toMatch(/up from|led the week/);
    expect(insight.pattern).toMatch(/Weekend movement|Protein/);
    expect(insight.focus.length).toBeGreaterThan(20);
  });
});

describe("selectNotification", () => {
  const insights = evaluateDay(day());

  it("observes quiet hours and stale action windows", () => {
    expect(selectNotification(insights, { minute: 450, sentToday: [] })).toBeNull();
    expect(selectNotification(insights, { minute: 1_330, sentToday: [] })).toBeNull();
    const stale = [{ ...insights[0]!, actionableUntil: 700 }];
    expect(selectNotification(stale, { minute: 720, sentToday: [] })).toBeNull();
  });

  it("enforces dedupe, the daily cap, and 120-minute nudge spacing", () => {
    const first = selectNotification(insights, { minute: 720, sentToday: [] });
    expect(first).not.toBeNull();
    expect(selectNotification(insights, { minute: 720, sentToday: [{ key: first!.key, kind: first!.kind, minute: 600 }] })?.key).not.toBe(first!.key);
    expect(selectNotification(insights, { minute: 720, sentToday: [{ key: "old", kind: "nudge", minute: 650 }] })).toBeNull();
    expect(selectNotification(insights, { minute: 900, sentToday: [{ key: "one", kind: "nudge", minute: 500 }, { key: "two", kind: "nudge", minute: 700 }] })).toBeNull();
  });

  it("limits feedback to two per day", () => {
    const feedback = evaluateDay(day({ meals: [{ minute: 600, calories: 1_500, proteinGrams: 100 }], steps: 8_000 }));
    expect(selectNotification(feedback, { minute: 900, sentToday: [{ key: "one", kind: "feedback", minute: 700 }, { key: "two", kind: "feedback", minute: 800 }] })).toBeNull();
  });
});
