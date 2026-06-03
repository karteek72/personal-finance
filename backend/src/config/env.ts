import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { resolve } from "node:path";
import { getRootLogger } from "../lib/logger.js";

loadDotenv({ path: resolve(process.cwd(), "../.env") });
loadDotenv({ path: resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().optional(),
  PLAID_CLIENT_ID: z.string().min(1),
  PLAID_SECRET: z.string().min(1),
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).default("sandbox"),
  PLAID_PRODUCTS: z.string().default("transactions"),
  PLAID_COUNTRY_CODES: z.string().default("US"),
  PLAID_REDIRECT_URI: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().url().optional(),
  ),
  APP_URL: z.string().url().default("http://localhost:4000"),
  /** Base URL for household invite links (web app). */
  UI_APP_URL: z.string().url().default("http://localhost:3002"),
  ENCRYPTION_KEY: z.string().optional(),
  REDIS_URL: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.string().url().optional(),
  ),
  DATABASE_URL: z
    .string()
    .default("postgresql://spendflow:spendflow@localhost:5433/spendflow"),
  JWT_SECRET: z.string().min(16).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_IDS: z.string().optional(),
  /** OAuth client secret (optional; ID-token sign-in does not require it). */
  GOOGLE_SECRET_KEY: z.string().min(1).optional(),
  AUTH_ALLOW_DEV_USER: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    getRootLogger().fatal(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      "invalid environment configuration",
    );
    throw new Error("Failed to load environment variables");
  }

  const env = parsed.data;
  if (
    env.NODE_ENV === "production" &&
    !(process.env.ENCRYPTION_KEY ?? "").trim()
  ) {
    getRootLogger().fatal(
      {},
      "ENCRYPTION_KEY is required when NODE_ENV=production (set in containers/.env; generate with: openssl rand -hex 32)",
    );
    throw new Error("ENCRYPTION_KEY is required in production");
  }

  if (
    env.NODE_ENV === "production" &&
    !(process.env.REDIS_URL ?? "").trim()
  ) {
    getRootLogger().fatal(
      {},
      "REDIS_URL is required when NODE_ENV=production (set in containers/.env; e.g. redis://redis:6379)",
    );
    throw new Error("REDIS_URL is required in production");
  }

  return env;
}
