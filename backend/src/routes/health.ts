import type { FastifyPluginAsync } from "fastify";
import { isRedisConfigured, pingRedis } from "../jobs/queue.js";
import { transactionCount } from "../services/transaction-store.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    let dbStatus = "disconnected";
    try {
      const count = await transactionCount();
      dbStatus = `connected (${count} transactions)`;
    } catch {
      dbStatus = "error";
    }

    let redisStatus = "disabled";
    if (isRedisConfigured(app.config.env)) {
      const ping = await pingRedis(app.config.env);
      redisStatus = ping === "connected" ? "connected" : "error";
    }

    return {
      status: "ok",
      version: "0.1.0",
      db: dbStatus,
      redis: redisStatus,
      plaid: app.config.env.PLAID_ENV,
    };
  });
};
