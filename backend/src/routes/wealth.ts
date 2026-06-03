import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { getInvestments, getNetWorth } from "../services/investments-store.js";
import { getFire } from "../services/planning-store.js";

export const wealthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/wealth/net-worth", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getNetWorth(user.id);
  });

  app.get("/wealth/investments", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getInvestments(user.id);
  });

  app.get("/wealth/fire", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const fire = await getFire(user.id);
    if (!fire) {
      throw AppError.notFound("No FIRE profile found");
    }
    return fire;
  });
};
