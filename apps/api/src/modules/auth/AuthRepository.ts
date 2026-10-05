import type { AuthSnapshot, LoginRequest, LoginResponse } from "@kimbo/contracts";

export interface AuthRepository {
  login(input: LoginRequest): Promise<LoginResponse>;
  snapshot(userId: string): Promise<AuthSnapshot>;
  authenticate(token: string): Promise<string | null>;
}
