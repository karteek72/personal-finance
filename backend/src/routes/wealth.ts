import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseBody } from "../lib/validate.js";
import { getInvestments, getNetWorth } from "../services/investments-store.js";
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
