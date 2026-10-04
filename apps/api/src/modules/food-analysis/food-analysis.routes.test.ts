import type { MealAnalysisResult } from "@kimbo/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../app.js";
import type {
  FoodAnalysisProvider,
  TranscriptionProvider,
} from "./FoodAnalysisProvider.js";

const result: MealAnalysisResult = {
  items: [
    {
      name: "Apple",
      portion: { amount: 1, unit: "piece", displayText: "1 medium apple" },
      nutrition: { calories: 95, proteinGrams: 0.5, carbsGrams: 25, fatGrams: 0.3 },
      confidence: 0.95,
    },
  ],
  overallConfidence: 0.95,
  warnings: [],
};

const foodAnalysisProvider: FoodAnalysisProvider = {
  analyseText: vi.fn(async () => result),
  analyseImage: vi.fn(async () => result),
};
const transcriptionProvider: TranscriptionProvider = {
  transcribe: vi.fn(async () => ({ transcript: "one apple", languageCode: "en-IN" })),
};

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.clearAllMocks();
});

const createApp = async () => {
  const app = await buildApp({
    env: {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: 3_000,
      DATABASE_URL: "postgres://unused",
      SARVAM_API_KEY: "not-used",
      BEDROCK_REGION: "ap-south-1",
      BEDROCK_MANTLE_API_KEY: "not-used",
      AI_PROVIDER: "mock",
    },
    foodAnalysisProvider,
    transcriptionProvider,
  });
  apps.push(app);
  return app;
};

describe("food analysis routes", () => {
  it("validates and analyses a text meal", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/meal-analyses/text",
      payload: { text: "I ate one apple", locale: "en-IN" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(result);
    expect(foodAnalysisProvider.analyseText).toHaveBeenCalledOnce();
  });

  it("rejects an empty meal description", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/meal-analyses/text",
      payload: { text: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(foodAnalysisProvider.analyseText).not.toHaveBeenCalled();
  });

  it("returns a typed client error for malformed JSON", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/meal-analyses/text",
      headers: { "content-type": "application/json" },
      payload: "{not-json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "VALIDATION_ERROR",
      retryable: false,
    });
  });

  it("rate limits AI endpoints per IP", async () => {
    const app = await createApp();
    const analyse = () =>
      app.inject({
        method: "POST",
        url: "/v1/meal-analyses/text",
        payload: { text: "I ate one apple", locale: "en-IN" },
      });

    for (let i = 0; i < 20; i++) expect((await analyse()).statusCode).toBe(200);
    const limited = await analyse();

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toMatchObject({ code: "RATE_LIMITED", retryable: true });
  });
});
