import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("jobs.queue");

export const PLAID_SYNC_QUEUE_NAME = "plaid-sync";
export const IMPORT_BATCH_QUEUE_NAME = "import-batch";

export interface PlaidSyncJobData {
  plaidItemId: string;
  webhookCode: string;
}

export interface ImportBatchJobData {
  batchId: string;
}

function attachRedisErrorLogger(client: Redis, label: string): void {
  client.on("error", (err: Error) => {
    log.warn({ err, label }, "redis connection error");
  });
}

let queue: Queue<PlaidSyncJobData> | null = null;
let importBatchQueue: Queue<ImportBatchJobData> | null = null;
let pingClient: Redis | null = null;

export function isRedisConfigured(env: Env): boolean {
  return Boolean(env.REDIS_URL?.trim());
}

export function getRedisConnectionOptions(env: Env): ConnectionOptions | null {
  if (!isRedisConfigured(env)) {
    return null;
  }

  return {
    url: env.REDIS_URL!,
    maxRetriesPerRequest: null,
  };
}

export function getPlaidSyncQueue(env: Env): Queue<PlaidSyncJobData> | null {
  if (!isRedisConfigured(env)) {
    return null;
  }

  if (!queue) {
    const connection = getRedisConnectionOptions(env);
    if (!connection) {
      return null;
    }

    queue = new Queue<PlaidSyncJobData>(PLAID_SYNC_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  return queue;
}

export async function pingRedis(
  env: Env,
): Promise<"connected" | "disconnected"> {
  if (!isRedisConfigured(env)) {
    return "disconnected";
  }

  try {
    if (!pingClient) {
      pingClient = new Redis(env.REDIS_URL!, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      attachRedisErrorLogger(pingClient, "ping");
    }

    const result = await pingClient.ping();
    return result === "PONG" ? "connected" : "disconnected";
  } catch (err) {
    log.warn({ err }, "redis ping failed");
    return "disconnected";
  }
}

export async function enqueuePlaidSync(
  env: Env,
  data: PlaidSyncJobData,
): Promise<boolean> {
  const q = getPlaidSyncQueue(env);
  if (!q) {
    return false;
  }

  await q.add("sync", data, {
    jobId: `plaid-sync-${data.plaidItemId}`,
  });
  return true;
}

export function getImportBatchQueue(
  env: Env,
): Queue<ImportBatchJobData> | null {
  if (!isRedisConfigured(env)) {
    return null;
  }

  if (!importBatchQueue) {
    const connection = getRedisConnectionOptions(env);
    if (!connection) {
      return null;
    }

    importBatchQueue = new Queue<ImportBatchJobData>(IMPORT_BATCH_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }

  return importBatchQueue;
}

export async function enqueueImportBatch(
  env: Env,
  batchId: string,
): Promise<boolean> {
  const q = getImportBatchQueue(env);
  if (!q) {
    return false;
  }

  await q.add("parse", { batchId }, { jobId: `import-batch-${batchId}` });
  return true;
}
