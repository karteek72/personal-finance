import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv, type Env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { createRootLogger, getRootLogger } from "./lib/logger.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { REQUEST_ID_HEADER, requestContextPlugin } from "./plugins/request-context.js";
import { authRoutes } from "./routes/auth.js";
import { householdRoutes } from "./routes/households.js";
import { healthRoutes } from "./routes/health.js";
import { accountRoutes } from "./routes/accounts.js";
import { plaidRoutes } from "./routes/plaid.js";
import { plaidWebhookRoutes } from "./routes/webhooks-plaid.js";
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
  const logLevel = env.NODE_ENV === "production" ? "info" : "debug";
  const logger = createRootLogger(logLevel);

  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: true,
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId(req) {
      const header = req.headers[REQUEST_ID_HEADER];
      if (typeof header === "string" && header.length > 0 && header.length <= 128) {
        return header;
      }
      return randomUUID();
    },
  });

  app.decorate("config", { env });

  await app.register(errorHandlerPlugin);
  await app.register(requestContextPlugin);

  const migrationLog = getRootLogger().child({ module: "db.migrate" });
  migrationLog.info("running database migrations");
  await runMigrations(env.DATABASE_URL);
  migrationLog.info("database migrations complete");

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
  await app.register(plaidWebhookRoutes, { prefix: "/api/v1" });
  await app.register(transactionRoutes, { prefix: "/api/v1" });
  await app.register(insightRoutes, { prefix: "/api/v1" });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info({ port: env.PORT }, "SpendFlow API listening");
}

main().catch((error: unknown) => {
  getRootLogger().fatal({ err: error }, "failed to start server");
  process.exit(1);
});
