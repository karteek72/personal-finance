import { loadEnv } from "./config/env.js";
import { createPlaidSyncWorker } from "./jobs/sync-transactions.job.js";
import { isRedisConfigured } from "./jobs/queue.js";
import { createRootLogger, getRootLogger } from "./lib/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logLevel = env.NODE_ENV === "production" ? "info" : "debug";
  createRootLogger(logLevel);
  const log = getRootLogger().child({ module: "worker" });

  if (!isRedisConfigured(env)) {
    log.fatal({}, "REDIS_URL is not configured — worker cannot start");
    process.exit(1);
  }

  const worker = createPlaidSyncWorker(env);
  if (!worker) {
    log.fatal({}, "failed to create Plaid sync worker");
    process.exit(1);
  }

  log.info("Plaid sync worker started");

  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, "shutting down worker");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

main().catch((error: unknown) => {
  getRootLogger().fatal({ err: error }, "failed to start worker");
  process.exit(1);
});
