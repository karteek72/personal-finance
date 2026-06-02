import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  listAccounts as getAccountsFromDb,
  getAlerts,
  getCategories,
  getChartData,
  getMoneyFlow,
  getSummary,
  getTrends,
  listTransactions,
} from "../services/transaction-store.js";
import { resolveScopedAccountIds } from "../services/household-store.js";
import { requireRequestUser } from "../lib/auth-http.js";
import type { Env } from "../config/env.js";

type ViewScope = "all" | "household" | "personal";

async function resolveScopeFilters(
  request: FastifyRequest,
  env: Env,
  query: {
    scope?: string;
    memberId?: string;
  },
) {
  const user = await requireRequestUser(request, env);
  const scope = (query.scope as ViewScope | undefined) ?? "all";
  const scopedAccountIds = await resolveScopedAccountIds(
    user.id,
    query.memberId ? undefined : scope === "all" ? undefined : scope,
    query.memberId,
  );
  return { user, scopedAccountIds };
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/transactions/summary", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = request.query as { from?: string; to?: string };
    return getSummary(user.id, query.from, query.to);
  });

  app.get("/transactions", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const scope = await resolveScopeFilters(request, app.config.env, query);

    return listTransactions({
      userId: scope.user.id,
      month: query.month,
      category: query.category,
      accountId: query.accountId,
      scopedAccountIds: scope.scopedAccountIds,
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
    const user = await requireRequestUser(request, app.config.env);
    const query = request.query as { from?: string; to?: string };
    return getCategories(user.id, query.from, query.to);
  });

  app.get("/transactions/chart-data", async (request) => {
    const query = request.query as {
      from?: string;
      to?: string;
      accountId?: string;
      category?: string;
      scope?: string;
      memberId?: string;
    };
    const scope = await resolveScopeFilters(request, app.config.env, query);

    return getChartData({
      userId: scope.user.id,
      from: query.from,
      to: query.to,
      accountId: query.accountId,
      category: query.category,
      scopedAccountIds: scope.scopedAccountIds,
    });
  });

  app.get("/transactions/flow", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = request.query as { from?: string; to?: string };
    return getMoneyFlow(user.id, query.from, query.to);
  });
};

export const insightRoutes: FastifyPluginAsync = async (app) => {
  app.get("/insights/alerts", async (request) => {
    await requireRequestUser(request, app.config.env);
    return getAlerts();
  });

  app.get("/insights/trends", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = request.query as { from?: string; to?: string };
    return getTrends(user.id, query.from, query.to);
  });
};

export async function getPlaidAccountsResponse(userId: string) {
  return getAccountsFromDb(userId);
}
