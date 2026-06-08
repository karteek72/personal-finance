import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseListQuery } from "../lib/list-query.js";
import { parseBody } from "../lib/validate.js";
import {
  getInvestments,
  getNetWorth,
  HOLDING_SORTABLE,
} from "../services/investments-store.js";
import { parsePositionKindFilter } from "../services/portfolio-analytics.js";
import { getFire, updateFireProfile } from "../services/planning-store.js";

const patchFireSchema = z
  .object({
    currentAge: z.number().int().min(18).max(100).optional(),
    withdrawalRate: z.number().min(1).max(10).optional(),
    realReturn: z.number().min(0).max(15).optional(),
  })
  .refine(
    (body) =>
      body.currentAge != null ||
      body.withdrawalRate != null ||
      body.realReturn != null,
    { message: "At least one field is required" },
  );

const fireQuerySchema = z.object({
  monthlySpend: z.coerce.number().min(0).optional(),
  monthlyInvest: z.coerce.number().min(0).optional(),
  withdrawalRate: z.coerce.number().min(1).max(10).optional(),
  realReturn: z.coerce.number().min(0).max(15).optional(),
});

export const wealthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/wealth/net-worth", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getNetWorth(user.id);
  });

  app.get("/wealth/investments", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const query = parseListQuery(request.query, {
      sortable: HOLDING_SORTABLE,
      defaultSort: "value",
      defaultDir: "desc",
    });
    const queryObj =
      typeof request.query === "object" && request.query != null
        ? request.query
        : {};
    const accountId =
      "accountId" in queryObj && typeof queryObj.accountId === "string"
        ? queryObj.accountId
        : undefined;
    const kind =
      "kind" in queryObj && typeof queryObj.kind === "string"
        ? parsePositionKindFilter(queryObj.kind)
        : "all";
    return getInvestments(user.id, query, { accountId, kind });
  });

  app.get("/wealth/fire", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const overrides = fireQuerySchema.parse(request.query);
    const fire = await getFire(user.id, overrides);
    if (!fire) {
      throw AppError.notFound("No FIRE profile found");
    }
    return fire;
  });

  app.patch("/wealth/fire", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(patchFireSchema, request.body);
    const fire = await updateFireProfile(user.id, body);
    if (!fire) {
      throw AppError.notFound("No FIRE profile found");
    }
    return fire;
  });
};
