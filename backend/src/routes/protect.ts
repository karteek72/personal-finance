import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { getInflation, getResilience } from "../services/protect-store.js";

export const protectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/protect/inflation", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const inflation = await getInflation(user.id);
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
