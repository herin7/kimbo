import type { DailyHealthSummary } from "@kimbo/contracts";
import { evaluateDay, type CoachingDay, type Insight } from "@kimbo/domain";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../db/database.js";
import { runCoaching, type CoachingJobSource, type CoachingJobUser } from "./coaching.job.js";

const summary = (date: string): DailyHealthSummary => ({ date, calories: 1_800, calorieTarget: 2_000, proteinGrams: 80, proteinTargetGrams: 100, steps: 6_000, stepTarget: 8_000, hasMealData: true, hasActivityData: true });
const baseDay: CoachingDay = {
  date: "2026-10-05",
  minute: 900,
  weekday: 1,
  calorieTarget: 2_000,
  proteinTargetGrams: 100,
  stepTarget: 8_000,
  meals: [{ minute: 540, calories: 500, proteinGrams: 10 }],
  steps: 1_000,
  history: [summary("2026-10-02"), summary("2026-10-03"), summary("2026-10-04")],
  sentToday: [],
};
const week = Array.from({ length: 7 }, (_, index) => summary(`2026-09-${String(29 + index).padStart(2, "0")}`));

describe("runCoaching", () => {
  it("keeps daily caps and key dedupe while sending the next eligible insight", async () => {
    const top = evaluateDay(baseDay)[0]!;
    const users: CoachingJobUser[] = [
      {
        userId: "10309734-0a44-46c6-b416-a63311b0cd93",
        token: "ExponentPushToken[dedupe]",
        timeZone: "Asia/Calcutta",
        day: { ...baseDay, sentToday: [top.key] },
        sentToday: [{ key: top.key, kind: "nudge", minute: 600 }],
        week,
        previousWeek: week,
      },
      {
        userId: "20309734-0a44-46c6-b416-a63311b0cd93",
        token: "ExponentPushToken[capped]",
        timeZone: "Asia/Calcutta",
        day: baseDay,
        sentToday: [{ key: "one", kind: "nudge", minute: 400 }, { key: "two", kind: "nudge", minute: 600 }],
        week,
        previousWeek: week,
      },
    ];
    const marked: Insight[] = [];
    const source: CoachingJobSource = {
      load: vi.fn(async () => users),
      markSent: vi.fn(async (_userId, insight) => { marked.push(insight); }),
      deleteToken: vi.fn(async () => undefined),
    };
    let requestBody = "";
    const fetcher: typeof fetch = vi.fn(async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ data: [{ status: "ok" }] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const result = await runCoaching({} as Database, new Date("2026-10-05T09:30:00.000Z"), { source, fetch: fetcher, apiUrl: "https://example.test" });

    expect(result).toEqual({ evaluated: 2, eligible: 1, sent: 1 });
    expect(marked).toHaveLength(1);
    expect(marked[0]?.key).not.toBe(top.key);
    const payload = JSON.parse(requestBody) as Array<{ richContent: { image: string } }>;
    expect(payload[0]?.richContent.image).toMatch(/notification-art/);
  });
});
