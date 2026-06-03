import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseBody } from "../lib/validate.js";
import { askCoach } from "../services/coach-ask.js";
import { getCoach, getWrapped } from "../services/coach-store.js";

const askCoachSchema = z.object({
  question: z.string().min(1).max(500),
});

export const coachRoutes: FastifyPluginAsync = async (app) => {
  app.get("/coach/insights", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getCoach(user.id);
  });

  app.post("/coach/ask", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(
      askCoachSchema,
      request.body,
      "question is required",
    );
    return askCoach(user.id, body.question);
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
