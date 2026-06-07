import { Worker, type Job } from "bullmq";
import type { Env } from "../config/env.js";
import { createLogger } from "../lib/logger.js";
import { logOperation, logOperationError } from "../lib/operation-log.js";
import { syncPlaidItemByPlaidItemId } from "../services/plaid/webhook-sync.js";
import {
  getRedisConnectionOptions,
  PLAID_SYNC_QUEUE_NAME,
  type PlaidSyncJobData,
} from "./queue.js";

const log = createLogger("jobs.sync-transactions");

export function createPlaidSyncWorker(env: Env): Worker<PlaidSyncJobData> | null {
  const connection = getRedisConnectionOptions(env);
  if (!connection) {
    return null;
  }

  const worker = new Worker<PlaidSyncJobData>(
    PLAID_SYNC_QUEUE_NAME,
    async (job: Job<PlaidSyncJobData>) => {
      const { plaidItemId, webhookCode } = job.data;

      logOperation(log, "started", "Processing Plaid sync job", {
        operation: "plaid.job_sync",
        operationId: String(job.id),
        plaidItemId,
        webhookCode,
        trigger: `webhook:${webhookCode}`,
      });

      try {
        await syncPlaidItemByPlaidItemId(plaidItemId, env, webhookCode);

        logOperation(log, "completed", "Plaid sync job finished", {
          operation: "plaid.job_sync",
          operationId: String(job.id),
          plaidItemId,
          webhookCode,
        });
      } catch (err) {
        logOperationError(
          log,
          "failed",
          "Plaid sync job failed",
          {
            operation: "plaid.job_sync",
            operationId: String(job.id),
            plaidItemId,
            webhookCode,
          },
          err,
        );
        throw err;
      }
    },
    { connection, concurrency: 2 },
  );

  worker.on("error", (err) => {
    log.error({ err }, "plaid sync worker error");
  });

  return worker;
}
