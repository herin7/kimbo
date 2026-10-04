import { LoginResponseSchema, type LoginRequest } from "@kimbo/contracts";

import { apiRequest } from "@/shared/api/api-client";

export function login(input: LoginRequest) {
  return apiRequest("/v1/auth/login", LoginResponseSchema, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
