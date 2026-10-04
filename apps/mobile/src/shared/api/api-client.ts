import { ApiErrorResponseSchema, type ApiErrorResponse } from "@kimbo/contracts";
import type { ZodType } from "zod";

import type { AppError } from "../errors/AppError";

const DEFAULT_TIMEOUT_MS = 30_000;

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? "http://10.0.2.2:3000" : "");

export class KimboApiError extends Error {
  constructor(readonly appError: AppError, message?: string) {
    super(message ?? appError.type);
    this.name = "KimboApiError";
  }
}

function mapServerError(error: ApiErrorResponse): AppError {
  switch (error.error.code) {
    case "AI_UNAVAILABLE":
      return { type: "AI_UNAVAILABLE" };
    case "INVALID_AI_RESPONSE":
      return { type: "INVALID_AI_RESPONSE" };
    case "VALIDATION_ERROR":
      return { type: "VALIDATION_ERROR", message: error.error.message };
    default:
      return { type: "NETWORK_ERROR" };
  }
}

export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  if (!apiBaseUrl) {
    throw new KimboApiError({ type: "NETWORK_ERROR" }, "EXPO_PUBLIC_API_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...init, signal: controller.signal });
    const body: unknown = await response.json();

    if (!response.ok) {
      const parsedError = ApiErrorResponseSchema.safeParse(body);
      throw new KimboApiError(
        parsedError.success ? mapServerError(parsedError.data) : { type: "NETWORK_ERROR" },
      );
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new KimboApiError({ type: "INVALID_AI_RESPONSE" });
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof KimboApiError) throw error;
    throw new KimboApiError({ type: "NETWORK_ERROR" });
  } finally {
    clearTimeout(timeout);
  }
}
