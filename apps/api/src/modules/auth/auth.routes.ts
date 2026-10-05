import { AuthSnapshotSchema, LoginRequestSchema, LoginResponseSchema } from "@kimbo/contracts";
import type { FastifyInstance } from "fastify";

import type { AuthRepository } from "./AuthRepository.js";
import { AppError } from "../../shared/errors/AppError.js";

export async function registerAuthRoutes(app: FastifyInstance, repository: AuthRepository) {
  app.post("/v1/auth/login", async (request) => {
    const result = await repository.login(LoginRequestSchema.parse(request.body));
    return LoginResponseSchema.parse(result);
  });

  app.get("/v1/auth/snapshot", async (request) => {
    const token = readBearerToken(request.headers.authorization);
    const userId = token ? await repository.authenticate(token) : null;
    if (!userId) throw new AppError("UNAUTHORIZED", "Sign in to refresh your account", 401, false);
    return AuthSnapshotSchema.parse(await repository.snapshot(userId));
  });
}

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
