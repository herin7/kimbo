import type { ActivitySession, ConfirmedMeal, HealthGoal } from "@kimbo/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type { FoodAnalysisProvider, TranscriptionProvider } from "../food-analysis/FoodAnalysisProvider.js";
import type { HealthDataRepository } from "./HealthDataRepository.js";

const foodAnalysisProvider: FoodAnalysisProvider = { analyseText: vi.fn(), analyseImage: vi.fn() };
const transcriptionProvider: TranscriptionProvider = { transcribe: vi.fn() };
const repository: HealthDataRepository = {
  upsertGoal: vi.fn(async (_userId, goal) => goal),
  createMeal: vi.fn(async (_userId, meal): Promise<ConfirmedMeal> => ({ ...meal, totals: { calories: 95, proteinGrams: 0.5, carbsGrams: 25, fatGrams: 0.3 }, syncStatus: "synced" })),
  upsertActivitySession: vi.fn(async (_userId, session) => ({ ...session, syncStatus: "synced" })),
};
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
    healthDataRepository: repository,
  });
  apps.push(app);
  return app;
}

const goal: HealthGoal = { goalType: "maintain", currentWeightKg: 70, targetWeightKg: 70, heightCm: 175, ageYears: 28, activityLevel: "moderate", timeZone: "Asia/Calcutta", dailyCalorieTarget: 2_100, dailyProteinTargetGrams: 100, dailyStepTarget: 8_000, updatedAt: "2026-10-04T09:00:00.000Z" };

describe("health data routes", () => {
  it("validates and upserts an anonymous user's goal", async () => {
    const app = await createApp();
    const userId = "10309734-0a44-46c6-b416-a63311b0cd93";
    const response = await app.inject({ method: "PUT", url: `/v1/users/${userId}/goal`, payload: goal });
    expect(response.statusCode).toBe(200);
    expect(repository.upsertGoal).toHaveBeenCalledWith(userId, goal);
  });

  it("rejects an activity whose body ID differs from the URL", async () => {
    const app = await createApp();
    const userId = "10309734-0a44-46c6-b416-a63311b0cd93";
    const session: ActivitySession = { id: "fd91cc15-8654-4f53-a133-a34458b8ccdf", type: "walking", state: "active", startedAt: "2026-10-04T09:00:00.000Z", endedAt: null, startingSteps: 1_000, currentSteps: 1_100, endingSteps: null, estimatedDistanceMeters: 76, syncStatus: "pending" };
    const response = await app.inject({ method: "PUT", url: `/v1/users/${userId}/activity-sessions/5f76779e-a641-46d6-a452-fda558cd557b`, payload: session });
    expect(response.statusCode).toBe(400);
    expect(repository.upsertActivitySession).not.toHaveBeenCalled();
  });
});
