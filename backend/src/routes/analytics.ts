import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseListQuery } from "../lib/list-query.js";
import {
  listMerchants,
  MERCHANT_SORTABLE,
} from "../services/analytics-merchants.js";
import { getDataQuality } from "../services/data-quality.js";
import { getInflationAnalytics } from "../services/analytics-inflation.js";
import { getResilienceAnalytics } from "../services/analytics-resilience.js";
import { getInvestmentBehavior } from "../services/investment-behavior.js";
import { getInvestmentPerformance } from "../services/investment-performance.js";
import {
  getGoalPacing,
  getObligationsCalendar,
  getPayoffSimulation,
  getPlanningScenarios,
  getRunwayForecast,
  getSurplusAllocation,
} from "../services/planning-engine.js";

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/analytics/merchants", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = parseListQuery(request.query, {
      sortable: MERCHANT_SORTABLE,
      defaultSort: "total",
      defaultDir: "desc",
    });
    return listMerchants(user.id, query);
  });

  app.get("/analytics/data-quality", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getDataQuality(user.id);
  });

  app.get("/analytics/inflation", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const inflation = await getInflationAnalytics(user.id);
    if (!inflation) {
      throw AppError.notFound("No inflation analytics available");
    }
    return inflation;
  });

  app.get("/analytics/resilience", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const resilience = await getResilienceAnalytics(user.id);
    if (!resilience) {
      throw AppError.notFound("No resilience analytics available");
    }
    return resilience;
  });

  app.get("/analytics/investments/performance", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const q = request.query as { from?: string; to?: string };
    const performance = await getInvestmentPerformance(user.id, q.from, q.to);
    if (!performance) {
      throw AppError.notFound("No investment performance data");
    }
    return performance;
  });

  app.get("/analytics/investments/behavior", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const behavior = await getInvestmentBehavior(user.id);
    if (!behavior) {
      throw AppError.notFound("No investment behavior data");
    }
    return behavior;
  });

  app.get("/analytics/planning/runway", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const runway = await getRunwayForecast(user.id);
    if (!runway) {
      throw AppError.notFound("No runway forecast available");
    }
    return runway;
  });

  app.get("/analytics/planning/payoff", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const q = request.query as { surplus?: string };
    const surplus = q.surplus ? Number.parseFloat(q.surplus) : undefined;
    const payoff = await getPayoffSimulation(user.id, surplus);
    if (!payoff) {
      throw AppError.notFound("No debt accounts for payoff simulation");
    }
    return payoff;
  });

  app.get("/analytics/planning/goals", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return { goals: await getGoalPacing(user.id) };
  });

  app.get("/analytics/planning/scenarios", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return { scenarios: await getPlanningScenarios(user.id) };
  });

  app.get("/analytics/planning/calendar", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return { obligations: await getObligationsCalendar(user.id) };
  });

  app.get("/analytics/planning/surplus", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const surplus = await getSurplusAllocation(user.id);
    if (!surplus) {
      throw AppError.notFound("No surplus allocation available");
    }
    return surplus;
  });
};
