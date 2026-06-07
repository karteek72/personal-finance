import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import {
  getBehavioral,
  getDna,
  getPatterns,
  getWellness,
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
    if (!dna) {
      throw AppError.notFound("No spending DNA found");
    }
    return dna;
  });

  app.get("/insights/patterns", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getPatterns(user.id);
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
