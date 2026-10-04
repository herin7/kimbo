import { ActivitySessionSchema, CreateMealRequestSchema, HealthGoalSchema } from "@kimbo/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { HealthDataRepository } from "./HealthDataRepository.js";
import type { AuthRepository } from "../auth/AuthRepository.js";
import { readBearerToken } from "../auth/auth.routes.js";
import { AppError } from "../../shared/errors/AppError.js";

const ParamsSchema = z.object({ userId: z.string().uuid() });

export async function registerHealthDataRoutes(app: FastifyInstance, repository: HealthDataRepository, authRepository?: AuthRepository) {
  const authorize = async (authorization: string | undefined, userId: string) => {
    if (!authRepository) return;
    const token = readBearerToken(authorization);
    const authenticatedUserId = token ? await authRepository.authenticate(token) : null;
    if (authenticatedUserId !== userId) {
      throw new AppError("UNAUTHORIZED", "Sign in again to continue", 401, false);
    }
  };
  app.put("/v1/users/:userId/goal", async (request) => {
    const { userId } = ParamsSchema.parse(request.params);
    await authorize(request.headers.authorization, userId);
    return repository.upsertGoal(userId, HealthGoalSchema.parse(request.body));
  });
  app.post("/v1/users/:userId/meals", async (request) => {
    const { userId } = ParamsSchema.parse(request.params);
    await authorize(request.headers.authorization, userId);
    return repository.createMeal(userId, CreateMealRequestSchema.parse(request.body));
  });
  app.put("/v1/users/:userId/activity-sessions/:sessionId", async (request) => {
    const { userId, sessionId } = ParamsSchema.extend({ sessionId: z.string().uuid() }).parse(request.params);
    await authorize(request.headers.authorization, userId);
    const session = ActivitySessionSchema.parse(request.body);
    if (session.id !== sessionId) {
      throw new z.ZodError([{ code: "custom", path: ["id"], message: "Session ID must match the URL" }]);
    }
    return repository.upsertActivitySession(userId, session);
  });
}
