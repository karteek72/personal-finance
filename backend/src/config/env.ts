import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { resolve } from "node:path";

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
  APP_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_URL: z
    .string()
    .default("postgresql://spendflow:spendflow@localhost:5433/spendflow"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Failed to load environment variables");
  }
  return parsed.data;
}
