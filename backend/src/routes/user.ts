import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseBody } from "../lib/validate.js";
import {
  EMPLOYMENT_STATUS_VALUES,
  RISK_TOLERANCE_VALUES,
  getAnalyticsProfile,
  getUserProfile,
  updateAnalyticsProfile,
  updateUserProfile,
} from "../services/user-profile-store.js";

const profileFieldsSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  currentAge: z.number().int().min(18).max(100).optional(),
  householdSize: z.number().int().min(1).max(20).nullable().optional(),
  annualGrossIncome: z.number().min(0).max(50_000_000).nullable().optional(),
  targetRetirementAge: z.number().int().min(18).max(100).nullable().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUS_VALUES).nullable().optional(),
  riskTolerance: z.enum(RISK_TOLERANCE_VALUES).nullable().optional(),
  withdrawalRate: z.number().min(1).max(10).optional(),
  realReturn: z.number().min(0).max(15).optional(),
});

const patchUserProfileSchema = profileFieldsSchema.refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one field is required" },
);

const patchAnalyticsProfileSchema = profileFieldsSchema
  .pick({
    currentAge: true,
    withdrawalRate: true,
    realReturn: true,
  })
  .refine(
    (body) =>
      body.currentAge != null ||
      body.withdrawalRate != null ||
      body.realReturn != null,
    { message: "At least one field is required" },
  );

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/user/profile", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getUserProfile(user.id);
  });

  app.patch("/user/profile", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(patchUserProfileSchema, request.body);
    return updateUserProfile(user.id, body);
  });

  app.get("/user/analytics-profile", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getAnalyticsProfile(user.id);
  });

  app.patch("/user/analytics-profile", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = parseBody(patchAnalyticsProfileSchema, request.body);
    return updateAnalyticsProfile(user.id, body);
  });
};
