import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseListQuery } from "../lib/list-query.js";
import {
  getInflation,
  getResilience,
  INFLATION_CATEGORY_SORTABLE,
} from "../services/protect-store.js";

export const protectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/protect/inflation", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = parseListQuery(request.query, {
      sortable: INFLATION_CATEGORY_SORTABLE,
      defaultSort: "share",
      defaultDir: "desc",
    });
    const inflation = await getInflation(user.id, query);
    if (!inflation) {
      throw AppError.notFound("No inflation profile found");
    }
    return inflation;
  });

  app.get("/protect/resilience", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const resilience = await getResilience(user.id);
    if (!resilience) {
      throw AppError.notFound("No resilience profile found");
    }
    return resilience;
  });
};
