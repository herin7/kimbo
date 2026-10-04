import { ActivitySessionSchema, CreateMealRequestSchema, HealthGoalSchema } from "@kimbo/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { HealthDataRepository } from "./HealthDataRepository.js";

const ParamsSchema = z.object({ userId: z.string().uuid() });

export async function registerHealthDataRoutes(app: FastifyInstance, repository: HealthDataRepository) {
  app.put("/v1/users/:userId/goal", async (request) => {
    const { userId } = ParamsSchema.parse(request.params);
    return repository.upsertGoal(userId, HealthGoalSchema.parse(request.body));
  });
  app.post("/v1/users/:userId/meals", async (request) => {
    const { userId } = ParamsSchema.parse(request.params);
    return repository.createMeal(userId, CreateMealRequestSchema.parse(request.body));
  });
  app.put("/v1/users/:userId/activity-sessions/:sessionId", async (request) => {
    const { userId, sessionId } = ParamsSchema.extend({ sessionId: z.string().uuid() }).parse(request.params);
    const session = ActivitySessionSchema.parse(request.body);
    if (session.id !== sessionId) {
      throw new z.ZodError([{ code: "custom", path: ["id"], message: "Session ID must match the URL" }]);
    }
    return repository.upsertActivitySession(userId, session);
  });
}
