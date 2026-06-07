import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { isSnaptradeConfigured } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { parseBody } from "../lib/validate.js";
import {
  createSnaptradePortalUrl,
  syncSnaptradeForUser,
} from "../services/snaptrade/sync.js";
import { toSnaptradeAppError } from "../services/snaptrade/errors.js";

const portalBodySchema = z.object({
  broker: z.string().optional(),
  reconnectAuthorizationId: z.string().optional(),
});

export const snaptradeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/snaptrade/portal-url", async (request) => {
    const body = parseBody(portalBodySchema, request.body ?? {});
    const user = await requireRequestUser(request, app.config.env);

    if (!isSnaptradeConfigured(app.config.env)) {
      throw AppError.providerNotConfigured("SnapTrade");
    }

    try {
      return await createSnaptradePortalUrl(user.id, app.config.env, {
        broker: body.broker,
        reconnectAuthorizationId: body.reconnectAuthorizationId,
      });
    } catch (error) {
      throw toSnaptradeAppError(
        error,
        "Unable to create SnapTrade connection portal URL",
      );
    }
  });

  app.post("/snaptrade/sync", async (request, reply) => {
    const user = await requireRequestUser(request, app.config.env);

    if (!isSnaptradeConfigured(app.config.env)) {
      throw AppError.providerNotConfigured("SnapTrade");
    }

    request.log.info(
      { userId: user.id, operation: "snaptrade.sync" },
      "SnapTrade sync accepted — background sync queued",
    );

    void syncSnaptradeForUser(user.id, app.config.env).catch(
      (error: unknown) => {
        request.log.error(
          { err: error, userId: user.id },
          "SnapTrade background sync failed",
        );
      },
    );

    return reply.status(202).send({
      status: "started",
      message:
        "Brokerage sync started in the background. Holdings will update shortly.",
    });
  });

  app.post("/snaptrade/complete", async (request) => {
    const user = await requireRequestUser(request, app.config.env);

    if (!isSnaptradeConfigured(app.config.env)) {
      throw AppError.providerNotConfigured("SnapTrade");
    }

    try {
      const syncResult = await syncSnaptradeForUser(user.id, app.config.env);
      return {
        status: "completed",
        ...syncResult,
        message: "Brokerage accounts connected and synced.",
      };
    } catch (error) {
      throw toSnaptradeAppError(
        error,
        "Unable to sync SnapTrade accounts after connection",
      );
    }
  });
};
