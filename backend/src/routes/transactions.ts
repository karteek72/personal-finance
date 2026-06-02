import type { FastifyPluginAsync } from "fastify";
import {
  listAccounts as getAccountsFromDb,
  getAlerts,
  getCategories,
  getChartData,
  getMoneyFlow,
  getSummary,
  getTrends,
  listTransactions,
  transactionCount,
} from "../services/transaction-store.js";
import { resolveScopedAccountIds } from "../services/household-store.js";
import { requireRequestUser } from "../lib/auth-http.js";
import type { Env } from "../config/env.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getAccounts as getMockAccounts } from "../services/mock-data.js";

type ViewScope = "all" | "household" | "personal";

async function resolveScopeFilters(
  request: FastifyRequest,
  reply: FastifyReply,
  env: Env,
  query: {
    scope?: string;
    memberId?: string;
  },
) {
  const user = await requireRequestUser(request, reply, env);
  if (!user) return null;
  const scope = (query.scope as ViewScope | undefined) ?? "all";
  const scopedAccountIds = await resolveScopedAccountIds(
    user.id,
    query.memberId ? undefined : scope === "all" ? undefined : scope,
    query.memberId,
  );
  return scopedAccountIds;
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/transactions/summary", async (request) => {
    const query = request.query as { from?: string; to?: string };
    return getSummary(query.from, query.to);
  });

  app.get("/transactions", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const scopedAccountIds = await resolveScopeFilters(
      request,
      reply,
      app.config.env,
      query,
    );
    if (scopedAccountIds === null) return;

    return listTransactions({
      month: query.month,
      category: query.category,
      accountId: query.accountId,
      scopedAccountIds,
      q: query.q,
      type: query.type,
      sort: query.sort as
        | "date_desc"
        | "date_asc"
        | "amount_desc"
        | "amount_asc"
        | "name_asc"
        | "name_desc"
        | "category_asc"
        | undefined,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
      cursor: query.cursor,
    });
  });

  app.get("/transactions/by-category", async (request) => {
    const query = request.query as { from?: string; to?: string };
    return getCategories(query.from, query.to);
  });

  app.get("/transactions/chart-data", async (request, reply) => {
    const query = request.query as {
      from?: string;
      to?: string;
      accountId?: string;
      category?: string;
      scope?: string;
      memberId?: string;
    };
    const scopedAccountIds = await resolveScopeFilters(
      request,
      reply,
      app.config.env,
      query,
    );
    if (scopedAccountIds === null) return;

    return getChartData({
      from: query.from,
      to: query.to,
      accountId: query.accountId,
      category: query.category,
      scopedAccountIds,
    });
  });

  app.get("/transactions/flow", async (request) => {
    const query = request.query as { from?: string; to?: string };
    return getMoneyFlow(query.from, query.to);
  });
};

export const insightRoutes: FastifyPluginAsync = async (app) => {
  app.get("/insights/alerts", async () => getAlerts());
  app.get("/insights/trends", async (request) => {
    const query = request.query as { from?: string; to?: string };
    return getTrends(query.from, query.to);
  });
};

export async function getPlaidAccountsResponse() {
  const count = await transactionCount();
  if (count > 0) {
    return getAccountsFromDb();
  }
  return getMockAccounts();
}
