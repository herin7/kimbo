import { LoginRequestSchema, LoginResponseSchema } from "@kimbo/contracts";
import type { FastifyInstance } from "fastify";

import type { AuthRepository } from "./AuthRepository.js";

export async function registerAuthRoutes(app: FastifyInstance, repository: AuthRepository) {
  app.post("/v1/auth/login", async (request) => {
    const result = await repository.login(LoginRequestSchema.parse(request.body));
    return LoginResponseSchema.parse(result);
  });
}

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
