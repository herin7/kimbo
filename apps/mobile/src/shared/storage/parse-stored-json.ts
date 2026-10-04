import type { ZodType } from "zod";

export function parseStoredJson<T>(value: string, schema: ZodType<T>): T | null {
  try {
    const result = schema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
