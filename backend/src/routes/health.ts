import type { FastifyPluginAsync } from "fastify";
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

    return {
      status: "ok",
      version: "0.1.0",
      db: dbStatus,
      redis: "mock",
      plaid: app.config.env.PLAID_ENV,
    };
  });
};
