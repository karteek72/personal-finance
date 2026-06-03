import type { FastifyPluginAsync } from "fastify";
import { requireRequestUser } from "../lib/auth-http.js";
import {
  getCreditDebtSummary,
  liabilityCoverageLabel,
} from "../services/liability-store.js";

export const liabilityRoutes: FastifyPluginAsync = async (app) => {
  app.get("/liabilities/summary", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const summary = await getCreditDebtSummary(user.id);
    const cardsWithData = summary.cards.filter((card) => card.liability).length;

    return {
      ...summary,
      coverageLabel: liabilityCoverageLabel(
        cardsWithData,
        summary.cards.length,
      ),
    };
  });
};
