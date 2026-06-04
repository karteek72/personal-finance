import type { FastifyPluginAsync } from "fastify";
import {
  isPlaidConfigured,
  isSnaptradeConfigured,
  isTellerConfigured,
} from "../config/env.js";
import { requireRequestUser } from "../lib/auth-http.js";

export const connectionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/connections/providers", async (request) => {
    await requireRequestUser(request, app.config.env);
    const env = app.config.env;

    return {
      providers: [
        {
          id: "plaid" as const,
          label: "Plaid",
          description: "Banks and credit cards via Plaid Link",
          accountTypes: ["depository", "credit", "investment"],
          enabled: isPlaidConfigured(env),
        },
        {
          id: "teller" as const,
          label: "Teller",
          description: "Checking, savings, and credit cards via Teller Connect",
          accountTypes: ["depository", "credit"],
          enabled: isTellerConfigured(env),
        },
        {
          id: "snaptrade" as const,
          label: "SnapTrade",
          description: "Brokerage and retirement accounts via SnapTrade",
          accountTypes: ["investment"],
          enabled: isSnaptradeConfigured(env),
        },
      ],
    };
  });
};
