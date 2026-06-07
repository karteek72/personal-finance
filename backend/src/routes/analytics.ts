import type { FastifyPluginAsync } from "fastify";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseListQuery } from "../lib/list-query.js";
import {
  listMerchants,
  MERCHANT_SORTABLE,
} from "../services/analytics-merchants.js";

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
};
