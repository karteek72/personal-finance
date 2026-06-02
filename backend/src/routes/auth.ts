import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
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
  app.post("/auth/google", async (request, reply) => {
    const body = googleBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      });
    }

    const clientIds = parseGoogleClientIds(app.config.env);
    if (clientIds.length === 0) {
      return reply.status(503).send({
        error: {
          code: "AUTH_NOT_CONFIGURED",
          message: "Google sign-in is not configured on the server",
        },
      });
    }

    let jwtSecret: string;
    try {
      jwtSecret = getJwtSecretForSigning(app.config.env);
    } catch {
      return reply.status(503).send({
        error: {
          code: "AUTH_NOT_CONFIGURED",
          message: "JWT signing is not configured",
        },
      });
    }

    try {
      const profile = await verifyGoogleIdToken(body.data.idToken, clientIds);
      const user = await findOrCreateUserFromGoogle(profile);
      const { accessToken, refreshToken } = await authTokens(user.id, jwtSecret);

      return {
        user: serializeUser(user),
        accessToken,
        refreshToken,
      };
    } catch (err) {
      request.log.warn({ err }, "Google sign-in failed");
      return reply.status(401).send({
        error: {
          code: "GOOGLE_AUTH_FAILED",
          message: "Could not verify Google sign-in",
        },
      });
    }
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshBodySchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
      });
    }

    let jwtSecret: string;
    try {
      jwtSecret = getJwtSecretForSigning(app.config.env);
    } catch {
      return reply.status(503).send({
        error: {
          code: "AUTH_NOT_CONFIGURED",
          message: "JWT signing is not configured",
        },
      });
    }

    try {
      const payload = await verifyRefreshToken(
        body.data.refreshToken,
        jwtSecret,
      );
      const user = await getUserById(payload.sub);
      if (!user) {
        return reply.status(401).send({
          error: { code: "UNAUTHENTICATED", message: "User not found" },
        });
      }

      const { accessToken, refreshToken } = await authTokens(user.id, jwtSecret);
      return { accessToken, refreshToken };
    } catch (err) {
      request.log.warn({ err }, "Token refresh failed");
      return reply.status(401).send({
        error: { code: "UNAUTHENTICATED", message: "Invalid refresh token" },
      });
    }
  });

  app.get("/auth/me", async (request, reply) => {
    const user = await resolveRequestUser(request, app.config.env);
    if (!user) {
      return reply.status(401).send({
        error: { code: "UNAUTHENTICATED", message: "Sign in required" },
      });
    }
    return { user: serializeUser(user) };
  });

  app.post("/auth/logout", async (_request, reply) => {
    return reply.status(204).send();
  });
};
