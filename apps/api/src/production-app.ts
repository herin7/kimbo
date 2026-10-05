import { buildApp } from "./app.js";
import type { Env } from "./config/env.js";
import { createDatabase } from "./db/database.js";
import { BedrockMantleClient } from "./modules/food-analysis/providers/BedrockMantleClient.js";
import { MockFoodAnalysisProvider } from "./modules/food-analysis/providers/MockFoodAnalysisProvider.js";
import { ProductionFoodAnalysisProvider } from "./modules/food-analysis/providers/ProductionFoodAnalysisProvider.js";
import { SarvamTranscriptionProvider } from "./modules/food-analysis/providers/SarvamTranscriptionProvider.js";
import { DrizzleHealthDataRepository } from "./modules/health-data/DrizzleHealthDataRepository.js";
import { DrizzleAuthRepository } from "./modules/auth/DrizzleAuthRepository.js";
import { DrizzleCoachingRepository } from "./modules/coaching/DrizzleCoachingRepository.js";

/** The real app with its real dependencies. Shared by the local server and the Lambda handler. */
export async function buildProductionRuntime(env: Env) {
  const database = createDatabase(env.DATABASE_URL);
  const foodAnalysisProvider =
    env.AI_PROVIDER === "mock"
      ? new MockFoodAnalysisProvider()
      : new ProductionFoodAnalysisProvider(
          new BedrockMantleClient(env.BEDROCK_MANTLE_API_KEY, env.BEDROCK_REGION),
        );

  const app = await buildApp({
    env,
    foodAnalysisProvider,
    transcriptionProvider: new SarvamTranscriptionProvider(env.SARVAM_API_KEY),
    healthDataRepository: new DrizzleHealthDataRepository(database.db),
    authRepository: new DrizzleAuthRepository(database.db),
    coachingRepository: new DrizzleCoachingRepository(database.db),
  });

  app.addHook("onClose", async () => database.close());
  return { app, db: database.db };
}

export async function buildProductionApp(env: Env) {
  return (await buildProductionRuntime(env)).app;
}
