import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { isTellerConfigured } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseBody } from "../lib/validate.js";
import {
  deleteTellerEnrollment,
  listTellerEnrollments,
  upsertTellerEnrollment,
} from "../services/teller/enrollment-store.js";
import { getTellerConnectConfig } from "../services/teller/client.js";
import { syncTellerEnrollment } from "../services/teller/sync.js";

const exchangeBodySchema = z.object({
  accessToken: z.string().min(1),
  enrollmentId: z.string().min(1),
  institutionName: z.string().optional(),
});

export const tellerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/teller/config", async (request) => {
    await requireRequestUser(request, app.config.env);
    if (!isTellerConfigured(app.config.env)) {
      throw AppError.providerNotConfigured("Teller");
    }
    return getTellerConnectConfig(app.config.env);
  });

  app.post("/teller/exchange", async (request) => {
    const body = parseBody(exchangeBodySchema, request.body);
    const user = await requireRequestUser(request, app.config.env);

    try {
      const { enrollment, syncResult } = await upsertTellerEnrollment(
        user.id,
        {
          accessToken: body.accessToken,
          enrollmentId: body.enrollmentId,
          institutionName: body.institutionName,
        },
        app.config.env,
      );

      return {
        enrollmentId: enrollment.tellerEnrollmentId,
        institutionName: syncResult.institutionName,
        accountsSynced: syncResult.accountsSynced,
        transactionsAdded: syncResult.transactionsAdded,
        message: "Account connected and transactions synced.",
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.tellerError("Unable to connect Teller enrollment", error);
    }
  });

  app.get("/teller/enrollments", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const items = await listTellerEnrollments(user.id);
    return { items };
  });

  app.post("/teller/enrollments/:enrollmentId/sync", async (request) => {
    const { enrollmentId } = request.params as { enrollmentId: string };
    const user = await requireRequestUser(request, app.config.env);
    const items = await listTellerEnrollments(user.id);
    const item = items.find(
      (row) => row.id === enrollmentId || row.tellerEnrollmentId === enrollmentId,
    );

    if (!item) {
      throw AppError.notFound("Teller enrollment not found");
    }

    try {
      const syncResult = await syncTellerEnrollment(item.id, app.config.env);
      return { status: "completed", ...syncResult };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.tellerSyncError("Unable to sync Teller enrollment", error);
    }
  });

  app.delete("/teller/enrollments/:enrollmentId", async (request, reply) => {
    const { enrollmentId } = request.params as { enrollmentId: string };
    const user = await requireRequestUser(request, app.config.env);
    const items = await listTellerEnrollments(user.id);
    const item = items.find(
      (row) => row.id === enrollmentId || row.tellerEnrollmentId === enrollmentId,
    );

    if (!item) {
      throw AppError.notFound("Teller enrollment not found");
    }

    await deleteTellerEnrollment(item.id, user.id);
    return reply.status(204).send();
  });
};
