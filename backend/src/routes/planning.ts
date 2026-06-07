import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseListQuery } from "../lib/list-query.js";
import { parseBody } from "../lib/validate.js";
import {
  getBudgets,
  getCalendar,
  getForecast,
  getRecurring,
  RECURRING_SORTABLE,
} from "../services/planning-store.js";
import {
  BUDGET_CLASS_VALUES,
  BUDGET_SOURCE_VALUES,
  GOAL_KIND_VALUES,
  GOAL_STATUS_VALUES,
  GOAL_SOURCE_VALUES,
  createGoal,
  deleteBudget,
  deleteGoal,
  patchBudget,
  patchGoal,
  upsertBudget,
} from "../services/planning/planning-crud.js";

const periodMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "periodMonth must be YYYY-MM");

const postBudgetSchema = z.object({
  category: z.string().min(1).max(120),
  periodMonth: periodMonthSchema,
  limit: z.number().min(0).max(10_000_000),
  emoji: z.string().max(16).optional(),
  color: z.string().max(32).optional(),
  source: z.enum(BUDGET_SOURCE_VALUES).optional(),
  class: z.enum(BUDGET_CLASS_VALUES).optional(),
});

const patchBudgetSchema = z
  .object({
    limit: z.number().min(0).max(10_000_000).optional(),
    emoji: z.string().max(16).nullable().optional(),
    color: z.string().max(32).nullable().optional(),
    class: z.enum(BUDGET_CLASS_VALUES).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

const postGoalSchema = z.object({
  name: z.string().min(1).max(120),
  target: z.number().min(0).max(100_000_000),
  current: z.number().min(0).max(100_000_000).optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  emoji: z.string().max(16).optional(),
  color: z.string().max(32).optional(),
  kind: z.enum(GOAL_KIND_VALUES).optional(),
  status: z.enum(GOAL_STATUS_VALUES).optional(),
  source: z.enum(GOAL_SOURCE_VALUES).optional(),
  accountId: z.string().uuid().nullable().optional(),
});

const patchGoalSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    target: z.number().min(0).max(100_000_000).optional(),
    current: z.number().min(0).max(100_000_000).optional(),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    emoji: z.string().max(16).nullable().optional(),
    color: z.string().max(32).nullable().optional(),
    kind: z.enum(GOAL_KIND_VALUES).optional(),
    status: z.enum(GOAL_STATUS_VALUES).optional(),
    accountId: z.string().uuid().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

export const planningRoutes: FastifyPluginAsync = async (app) => {
  app.get("/planning/budgets", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getBudgets(user.id);
  });

  app.post("/planning/budgets", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(postBudgetSchema, request.body);
    return upsertBudget(user.id, body);
  });

  app.patch("/planning/budgets/:budgetId", async (request) => {
    const { budgetId } = request.params as { budgetId: string };
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(patchBudgetSchema, request.body);
    return patchBudget(user.id, budgetId, body);
  });

  app.delete("/planning/budgets/:budgetId", async (request) => {
    const { budgetId } = request.params as { budgetId: string };
    const user = await requireRequestUser(request, app.config.env);
    return deleteBudget(user.id, budgetId);
  });

  app.post("/planning/goals", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(postGoalSchema, request.body);
    return createGoal(user.id, body);
  });

  app.patch("/planning/goals/:goalId", async (request) => {
    const { goalId } = request.params as { goalId: string };
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(patchGoalSchema, request.body);
    return patchGoal(user.id, goalId, body);
  });

  app.delete("/planning/goals/:goalId", async (request) => {
    const { goalId } = request.params as { goalId: string };
    const user = await requireRequestUser(request, app.config.env);
    return deleteGoal(user.id, goalId);
  });

  app.get("/planning/recurring", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = parseListQuery(request.query, {
      sortable: RECURRING_SORTABLE,
      defaultSort: "amount",
      defaultDir: "desc",
    });
    return getRecurring(user.id, query);
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
