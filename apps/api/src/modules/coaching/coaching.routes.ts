import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AppError } from "../../shared/errors/AppError.js";
import type { AuthRepository } from "../auth/AuthRepository.js";
import { readBearerToken } from "../auth/auth.routes.js";
import type { CoachingRepository } from "./CoachingRepository.js";

const UserParamsSchema = z.object({ userId: z.string().uuid() });
const PushTokenSchema = z.string().regex(/^ExponentPushToken\[[^\]]+\]$/).max(512);
const DailySummarySchema = z.object({
  calories: z.number().int().nonnegative().max(20_000),
  proteinGrams: z.number().finite().nonnegative().max(2_000),
  steps: z.number().int().nonnegative().max(1_000_000).nullable(),
  hasMealData: z.boolean(),
  hasActivityData: z.boolean(),
});

export async function registerCoachingRoutes(app: FastifyInstance, repository: CoachingRepository, authRepository: AuthRepository) {
  const authorize = async (authorization: string | undefined, userId: string) => {
    const token = readBearerToken(authorization);
    const authenticatedUserId = token ? await authRepository.authenticate(token) : null;
    if (authenticatedUserId !== userId) throw new AppError("UNAUTHORIZED", "Sign in again to continue", 401, false);
  };

  app.put("/v1/users/:userId/push-token", async (request) => {
    const { userId } = UserParamsSchema.parse(request.params);
    await authorize(request.headers.authorization, userId);
    const { token } = z.object({ token: PushTokenSchema }).parse(request.body);
    await repository.upsertPushToken(userId, token);
    return { ok: true };
  });

  app.delete("/v1/users/:userId/push-token/:token", async (request) => {
    const { userId, token } = UserParamsSchema.extend({ token: PushTokenSchema }).parse(request.params);
    await authorize(request.headers.authorization, userId);
    await repository.deletePushToken(userId, token);
    return { ok: true };
  });

  app.put("/v1/users/:userId/daily-summaries/:date", async (request) => {
    const { userId, date } = UserParamsSchema.extend({ date: z.string().date() }).parse(request.params);
    await authorize(request.headers.authorization, userId);
    await repository.upsertDailySummary(userId, date, DailySummarySchema.parse(request.body));
    return { ok: true };
  });
}
