import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv, type Env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { authRoutes } from "./routes/auth.js";
import { householdRoutes } from "./routes/households.js";
import { healthRoutes } from "./routes/health.js";
import { accountRoutes } from "./routes/accounts.js";
import { plaidRoutes } from "./routes/plaid.js";
import {
  transactionRoutes,
  insightRoutes,
} from "./routes/transactions.js";

declare module "fastify" {
  interface FastifyInstance {
    config: { env: Env };
  }
}

async function main(): Promise<void> {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "info" : "warn",
    },
  });

  app.decorate("config", { env });

  await runMigrations(env.DATABASE_URL);

  const allowedOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
    : [env.CORS_ORIGIN];

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (
        env.NODE_ENV === "development" &&
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS not allowed"), false);
    },
    credentials: true,
  });

  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(householdRoutes, { prefix: "/api/v1" });
  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(accountRoutes, { prefix: "/api/v1" });
  await app.register(plaidRoutes, { prefix: "/api/v1" });
  await app.register(transactionRoutes, { prefix: "/api/v1" });
  await app.register(insightRoutes, { prefix: "/api/v1" });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`SpendFlow API listening on http://localhost:${env.PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
