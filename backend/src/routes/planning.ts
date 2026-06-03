import type { FastifyPluginAsync } from "fastify";
import { requireRequestUser } from "../lib/auth-http.js";
import {
  getBudgets,
  getCalendar,
  getForecast,
  getRecurring,
} from "../services/planning-store.js";

export const planningRoutes: FastifyPluginAsync = async (app) => {
  app.get("/planning/budgets", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getBudgets(user.id);
  });

  app.get("/planning/recurring", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getRecurring(user.id);
  });

  app.get("/planning/calendar", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getCalendar(user.id);
  });

  app.get("/planning/forecast", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getForecast(user.id);
  });
};
