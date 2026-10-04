export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AI_UNAVAILABLE"
  | "INVALID_AI_RESPONSE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly statusCode: number,
    readonly retryable: boolean,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const invalidAiResponse = (details?: unknown) =>
  new AppError(
    "INVALID_AI_RESPONSE",
    "The food analysis provider returned an invalid response",
    502,
    true,
    details,
  );

export const aiUnavailable = (details?: unknown) =>
  new AppError(
    "AI_UNAVAILABLE",
    "The food analysis provider is temporarily unavailable",
    503,
    true,
    details,
  );
