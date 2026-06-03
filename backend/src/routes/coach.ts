import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { getCoach, getWrapped } from "../services/coach-store.js";

export const coachRoutes: FastifyPluginAsync = async (app) => {
  app.get("/coach/insights", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getCoach(user.id);
  });

  app.get("/wrapped", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const wrapped = await getWrapped(user.id);
    if (!wrapped) {
      throw AppError.notFound("No wrapped summary found");
    }
    return wrapped;
  });
};
