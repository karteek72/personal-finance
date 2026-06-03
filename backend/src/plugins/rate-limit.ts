import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { Redis } from "ioredis";
import type { Env } from "../config/env.js";
import { isRedisConfigured } from "../jobs/queue.js";
import { AppError } from "../lib/errors.js";
import { createLogger } from "../lib/logger.js";
import { resolveRequestUser } from "../services/auth/request-user.js";

const log = createLogger("plugins.rate-limit");

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return {0, 0}
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
if #oldest == 0 then
  return {0, 0}
end

local oldest_score = tonumber(oldest[2])
local retry_ms = oldest_score + window - now
if retry_ms < 1000 then
  retry_ms = 1000
end
return {1, retry_ms}
`;

function isExcludedFromRateLimit(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return path.endsWith("/health") || path.includes("/webhooks/plaid");
}

function retryAfterSeconds(retryMs: number): number {
  return Math.max(1, Math.ceil(retryMs / 1000));
}

let rateLimitRedis: Redis | null = null;

function getRateLimitRedis(env: Env): Redis {
  if (!rateLimitRedis) {
    rateLimitRedis = new Redis(env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return rateLimitRedis;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

async function checkSlidingWindow(
  redis: Redis,
  userId: string,
): Promise<RateLimitResult> {
  const key = `ratelimit:user:${userId}`;
  const now = Date.now();
  const member = `${now}:${randomUUID()}`;

  const raw = await redis.eval(
    SLIDING_WINDOW_SCRIPT,
    1,
    key,
    String(now),
    String(WINDOW_MS),
    String(MAX_REQUESTS),
    member,
  );

  if (!Array.isArray(raw) || raw.length < 2) {
    log.warn({ userId }, "unexpected rate limit script result");
    return { allowed: true, retryAfterSec: 0 };
  }

  const limited = Number(raw[0]) === 1;
  const retryMs = Number(raw[1]);
  return {
    allowed: !limited,
    retryAfterSec: limited ? retryAfterSeconds(retryMs) : 0,
  };
}

export const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  const env = app.config.env;

  if (!isRedisConfigured(env)) {
    log.info("rate limiting disabled (REDIS_URL not set)");
    return;
  }

  const redis = getRateLimitRedis(env);

  app.addHook("onClose", async () => {
    if (rateLimitRedis) {
      await rateLimitRedis.quit();
      rateLimitRedis = null;
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (isExcludedFromRateLimit(request.url)) {
      return;
    }

    let userId = request.spendflowUser?.id;
    if (!userId) {
      const user = await resolveRequestUser(request, env);
      if (!user) {
        return;
      }
      request.spendflowUser = { id: user.id, email: user.email };
      userId = user.id;
    }

    try {
      const result = await checkSlidingWindow(redis, userId);
      if (!result.allowed) {
        request.log.warn(
          { userId, retryAfterSec: result.retryAfterSec },
          "rate limit exceeded",
        );
        const body = AppError.rateLimited().toJSON();
        return reply
          .status(429)
          .header("Retry-After", String(result.retryAfterSec))
          .send(body);
      }
    } catch (err) {
      request.log.warn({ err, userId }, "rate limit check failed; allowing request");
    }
  });
};
