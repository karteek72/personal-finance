import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseBody } from "../lib/validate.js";
import {
  assignAccountToMember,
  createHouseholdMember,
  deleteHouseholdMember,
  getHouseholdDetails,
  getHouseholdInsights,
  updateHouseholdMember,
  updateHouseholdName,
} from "../services/household-store.js";

const createMemberSchema = z.object({
  displayName: z.string().min(1).max(80),
  role: z.enum(["partner", "child", "other"]),
});

const updateMemberSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  role: z.enum(["owner", "partner", "child", "other"]).optional(),
});

const updateHouseholdSchema = z.object({
  name: z.string().min(1).max(120),
});

const assignAccountSchema = z.object({
  memberId: z.string().uuid(),
});

export const householdRoutes: FastifyPluginAsync = async (app) => {
  app.get("/household", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getHouseholdDetails(user.id);
  });

  app.patch("/household", async (request) => {
    const body = parseBody(updateHouseholdSchema, request.body, "Invalid household name");
    const user = await requireRequestUser(request, app.config.env);
    const updated = await updateHouseholdName(user.id, body.name);
    return {
      id: updated.id,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
    };
  });

  app.get("/household/insights", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    return getHouseholdInsights(user.id);
  });

  app.post("/household/members", async (request) => {
    const body = parseBody(createMemberSchema, request.body, "Invalid member data");
    const user = await requireRequestUser(request, app.config.env);
    return createHouseholdMember(user.id, body);
  });

  app.patch("/household/members/:memberId", async (request) => {
    const { memberId } = request.params as { memberId: string };
    const body = parseBody(updateMemberSchema, request.body, "Invalid member update");
    const user = await requireRequestUser(request, app.config.env);
    const updated = await updateHouseholdMember(user.id, memberId, body);
    if (!updated) {
      throw AppError.notFound("Member not found or cannot update");
    }
    return updated;
  });

  app.delete("/household/members/:memberId", async (request) => {
    const { memberId } = request.params as { memberId: string };
    const user = await requireRequestUser(request, app.config.env);
    const deleted = await deleteHouseholdMember(user.id, memberId);
    if (!deleted) {
      throw AppError.notFound("Member not found or cannot delete owner");
    }
    return { status: "deleted", memberId };
  });

  app.put("/household/accounts/:accountId/assign", async (request) => {
    const { accountId } = request.params as { accountId: string };
    const body = parseBody(assignAccountSchema, request.body, "memberId is required");
    const user = await requireRequestUser(request, app.config.env);
    const result = await assignAccountToMember(
      user.id,
      accountId,
      body.memberId,
    );
    if (!result) {
      throw AppError.notFound("Account or member not found");
    }
    return result;
  });
};
