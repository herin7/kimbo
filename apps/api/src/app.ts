import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";

import type { Env } from "./config/env.js";
import type {
  FoodAnalysisProvider,
  TranscriptionProvider,
} from "./modules/food-analysis/FoodAnalysisProvider.js";
import { registerFoodAnalysisRoutes } from "./modules/food-analysis/food-analysis.routes.js";
import type { HealthDataRepository } from "./modules/health-data/HealthDataRepository.js";
import { registerHealthDataRoutes } from "./modules/health-data/health-data.routes.js";
import { AppError } from "./shared/errors/AppError.js";

export interface AppDependencies {
  env: Env;
  foodAnalysisProvider: FoodAnalysisProvider;
  transcriptionProvider: TranscriptionProvider;
  healthDataRepository?: HealthDataRepository;
}

export async function buildApp(dependencies: AppDependencies) {
  const app = Fastify({
    logger: dependencies.env.NODE_ENV !== "test",
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: dependencies.env.NODE_ENV === "production" ? false : true,
  });
  await app.register(multipart);
  // Keyed by request.ip. trustProxy stays off: on Lambda, @fastify/aws-lambda injects the Function URL's
  // sourceIp as the remote address, so a client-sent X-Forwarded-For can't dodge the limit.
  await app.register(rateLimit, { global: true, max: 120, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok" }));
  await registerFoodAnalysisRoutes(app, dependencies);
  if (dependencies.healthDataRepository) {
    await registerHealthDataRoutes(app, dependencies.healthDataRepository);
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request did not match the expected format",
          retryable: false,
          requestId: request.id,
          details: error.flatten(),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          requestId: request.id,
          details: error.details,
        },
      });
    }

    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : null;
    if (statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again in a minute.",
          retryable: true,
          requestId: request.id,
        },
      });
    }

    if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: "VALIDATION_ERROR",
          message: statusCode === 413
            ? "The uploaded file is too large"
            : "The request could not be read",
          retryable: false,
          requestId: request.id,
        },
      });
    }

    request.log.error({ err: error }, "Unhandled request error");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        retryable: true,
        requestId: request.id,
      },
    });
  });

  return app;
}
