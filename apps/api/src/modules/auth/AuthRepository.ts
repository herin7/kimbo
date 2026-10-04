import type { LoginRequest, LoginResponse } from "@kimbo/contracts";

export interface AuthRepository {
  login(input: LoginRequest): Promise<LoginResponse>;
  authenticate(token: string): Promise<string | null>;
}
