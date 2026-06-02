import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  assignAccountToMember,
  createHouseholdMember,
  deleteHouseholdMember,
  getHouseholdDetails,
  getHouseholdInsights,
  updateHouseholdMember,
  updateHouseholdName,
} from "../services/household-store.js";
import { requireRequestUser } from "../lib/auth-http.js";

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
  app.get("/household", async (request, reply) => {
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    return getHouseholdDetails(user.id);
  });

  app.patch("/household", async (request, reply) => {
    const body = updateHouseholdSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid household name" },
      });
    }

    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const updated = await updateHouseholdName(user.id, body.data.name);
    return {
      id: updated.id,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
    };
  });

  app.get("/household/insights", async (request, reply) => {
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    return getHouseholdInsights(user.id);
  });

  app.post("/household/members", async (request, reply) => {
    const body = createMemberSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid member data" },
      });
    }

    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const member = await createHouseholdMember(user.id, body.data);
    return member;
  });

  app.patch("/household/members/:memberId", async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const body = updateMemberSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid member update" },
      });
    }

    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const updated = await updateHouseholdMember(user.id, memberId, body.data);
    if (!updated) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Member not found or cannot update" },
      });
    }
    return updated;
  });

  app.delete("/household/members/:memberId", async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const deleted = await deleteHouseholdMember(user.id, memberId);
    if (!deleted) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Member not found or cannot delete owner" },
      });
    }
    return { status: "deleted", memberId };
  });

  app.put("/household/accounts/:accountId/assign", async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const body = assignAccountSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "memberId is required" },
      });
    }

    const user = await requireRequestUser(request, reply, app.config.env);
    if (!user) return;
    const result = await assignAccountToMember(
      user.id,
      accountId,
      body.data.memberId,
    );
    if (!result) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Account or member not found" },
      });
    }
    return result;
  });
};
