import type { FastifyPluginAsync } from "fastify";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseListQuery } from "../lib/list-query.js";
import {
  emptyDnaResponse,
  getBehavioral,
  getDna,
  getPatterns,
  getWellness,
  PATTERN_SORTABLE,
} from "../services/insights-store.js";
import { getMerchants } from "../services/coach-store.js";

export const insightRoutesV2: FastifyPluginAsync = async (app) => {
  app.get("/insights/wellness", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getWellness(user.id);
  });

  app.get("/insights/dna", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const dna = await getDna(user.id);
    return dna ?? emptyDnaResponse();
  });

  app.get("/insights/patterns", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = parseListQuery(request.query, {
      sortable: PATTERN_SORTABLE,
      defaultSort: "value",
      defaultDir: "desc",
    });
    return getPatterns(user.id, query);
  });

  app.get("/insights/behavioral", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getBehavioral(user.id);
  });

  app.get("/insights/merchants", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getMerchants(user.id);
  });
};
