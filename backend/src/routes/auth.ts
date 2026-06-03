import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import { getDb } from "../db/client.js";
import { parseBody } from "../lib/validate.js";
import {
  auditContextFromRequest,
  logAuditEvent,
} from "../services/import/import-audit.js";
import { buildUserDataExport } from "../services/export-user-data.js";
import { verifyGoogleIdToken } from "../services/auth/google.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../services/auth/jwt.js";
import {
  getJwtSecretForSigning,
  parseGoogleClientIds,
  resolveRequestUser,
} from "../services/auth/request-user.js";
import {
  findOrCreateUserFromGoogle,
  getUserById,
  serializeUser,
} from "../services/auth/user-auth.js";

const googleBodySchema = z.object({
  idToken: z.string().min(1),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

function authTokens(userId: string, jwtSecret: string) {
  return Promise.all([
    signAccessToken(userId, jwtSecret),
    signRefreshToken(userId, jwtSecret),
  ]).then(([accessToken, refreshToken]) => ({ accessToken, refreshToken }));
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/google", async (request) => {
    const body = parseBody(googleBodySchema, request.body);

    const clientIds = parseGoogleClientIds(app.config.env);
    if (clientIds.length === 0) {
      throw AppError.authNotConfigured("Google sign-in is not configured on the server");
    }

    let jwtSecret: string;
    try {
      jwtSecret = getJwtSecretForSigning(app.config.env);
    } catch {
      throw AppError.authNotConfigured("JWT signing is not configured");
    }

    try {
      const profile = await verifyGoogleIdToken(body.idToken, clientIds);
      const user = await findOrCreateUserFromGoogle(profile);
      const { accessToken, refreshToken } = await authTokens(user.id, jwtSecret);

      request.log.info({ userId: user.id }, "user signed in with google");

      return {
        user: serializeUser(user),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.googleAuthFailed(error);
    }
  });

  app.post("/auth/refresh", async (request) => {
    const body = parseBody(refreshBodySchema, request.body);

    let jwtSecret: string;
    try {
      jwtSecret = getJwtSecretForSigning(app.config.env);
    } catch {
      throw AppError.authNotConfigured("JWT signing is not configured");
    }

    try {
      const payload = await verifyRefreshToken(body.refreshToken, jwtSecret);
      const user = await getUserById(payload.sub);
      if (!user) {
        throw AppError.unauthenticated("User not found");
      }

      const { accessToken, refreshToken } = await authTokens(user.id, jwtSecret);
      return { accessToken, refreshToken };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.unauthenticated("Invalid refresh token");
    }
  });

  app.get("/auth/me", async (request) => {
    const user = await resolveRequestUser(request, app.config.env);
    if (!user) {
      throw AppError.unauthenticated();
    }
    return { user: serializeUser(user) };
  });

  app.get("/auth/export", async (request, reply) => {
    const user = await requireRequestUser(request, app.config.env);
    const db = getDb();
    const auditCtx = auditContextFromRequest(request);

    const payload = await buildUserDataExport(user.id, db);

    await logAuditEvent(
      db,
      user.id,
      "data_export",
      "user",
      user.id,
      {
        exportVersion: payload.exportVersion,
        transactionCount: payload.transactions.length,
        accountCount: payload.accounts.length,
      },
      auditCtx,
    );

    const stamp = payload.exportedAt.slice(0, 10);
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header(
      "Content-Disposition",
      `attachment; filename="spendflow-export-${stamp}.json"`,
    );
    reply.header("Cache-Control", "no-store");

    return payload;
  });

  app.post("/auth/logout", async (_request, reply) => {
    return reply.status(204).send();
  });
};
