import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("jobs.queue");

export const PLAID_SYNC_QUEUE_NAME = "plaid-sync";

export interface PlaidSyncJobData {
  plaidItemId: string;
  webhookCode: string;
}

let queue: Queue<PlaidSyncJobData> | null = null;
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
