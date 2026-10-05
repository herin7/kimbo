import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { AuthRepository } from "../auth/AuthRepository.js";
import type { FoodAnalysisProvider, TranscriptionProvider } from "../food-analysis/FoodAnalysisProvider.js";
import type { CoachingRepository } from "./CoachingRepository.js";

const userId = "10309734-0a44-46c6-b416-a63311b0cd93";
const token = "ExponentPushToken[test-device-token]";
const coachingRepository: CoachingRepository = {
  upsertPushToken: vi.fn(async () => undefined),
  deletePushToken: vi.fn(async () => undefined),
  upsertDailySummary: vi.fn(async () => undefined),
};
const authRepository: AuthRepository = {
  authenticate: vi.fn(async (value) => value === "valid" ? userId : null),
  login: vi.fn(),
  snapshot: vi.fn(),
};
const foodAnalysisProvider: FoodAnalysisProvider = { analyseText: vi.fn(), analyseImage: vi.fn() };
const transcriptionProvider: TranscriptionProvider = { transcribe: vi.fn() };
const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.clearAllMocks();
});

async function createApp() {
  const app = await buildApp({
    env: { NODE_ENV: "test", HOST: "127.0.0.1", PORT: 3_000, DATABASE_URL: "postgres://unused", SARVAM_API_KEY: "unused", BEDROCK_REGION: "ap-south-1", BEDROCK_MANTLE_API_KEY: "unused", AI_PROVIDER: "mock" },
    foodAnalysisProvider,
    transcriptionProvider,
    coachingRepository,
    authRepository,
  });
  apps.push(app);
  return app;
}

describe("coaching routes", () => {
  it("registers and removes a validated token for the authenticated user", async () => {
    const app = await createApp();
    const headers = { authorization: "Bearer valid" };
    expect((await app.inject({ method: "PUT", url: `/v1/users/${userId}/push-token`, headers, payload: { token } })).statusCode).toBe(200);
    expect(coachingRepository.upsertPushToken).toHaveBeenCalledWith(userId, token);
    expect((await app.inject({ method: "DELETE", url: `/v1/users/${userId}/push-token/${encodeURIComponent(token)}`, headers })).statusCode).toBe(200);
    expect(coachingRepository.deletePushToken).toHaveBeenCalledWith(userId, token);
  });

  it("rejects malformed tokens and another user's request", async () => {
    const app = await createApp();
    expect((await app.inject({ method: "PUT", url: `/v1/users/${userId}/push-token`, headers: { authorization: "Bearer valid" }, payload: { token: "not-a-token" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: `/v1/users/20309734-0a44-46c6-b416-a63311b0cd93/push-token`, headers: { authorization: "Bearer valid" }, payload: { token } })).statusCode).toBe(401);
  });

  it("upserts a validated daily summary", async () => {
    const app = await createApp();
    const summary = { calories: 1_700, proteinGrams: 82, steps: 6_400, hasMealData: true, hasActivityData: true };
    const response = await app.inject({ method: "PUT", url: `/v1/users/${userId}/daily-summaries/2026-10-05`, headers: { authorization: "Bearer valid" }, payload: summary });
    expect(response.statusCode).toBe(200);
    expect(coachingRepository.upsertDailySummary).toHaveBeenCalledWith(userId, "2026-10-05", summary);
  });
});
