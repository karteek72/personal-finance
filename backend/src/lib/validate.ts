import type { ZodSchema } from "zod";
import { AppError } from "./errors.js";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown, message?: string): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw AppError.validation(message ?? "Invalid request body", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}
