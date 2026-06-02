import type { FastifyRequest } from "fastify";
import type { Env } from "../../config/env.js";
import { getOrCreateDevUser } from "../user-store.js";
import { verifyAccessToken } from "./jwt.js";
import { getUserById, type UserRecord } from "./user-auth.js";

function resolveJwtSecret(env: Env): string | undefined {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.NODE_ENV === "development") {
    return "dev-insecure-jwt-secret-change-me";
  }
  return undefined;
}

function allowDevUser(env: Env): boolean {
  if (env.AUTH_ALLOW_DEV_USER !== undefined) {
    return env.AUTH_ALLOW_DEV_USER;
  }
  return env.NODE_ENV === "development";
}

export async function resolveRequestUser(
  request: FastifyRequest,
  env: Env,
): Promise<UserRecord | null> {
  const jwtSecret = resolveJwtSecret(env);
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith("Bearer ") && jwtSecret) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) {
      try {
        const payload = await verifyAccessToken(token, jwtSecret);
        const user = await getUserById(payload.sub);
        if (user) return user;
      } catch {
        return null;
      }
    }
  }

  if (allowDevUser(env)) {
    return getOrCreateDevUser();
  }

  return null;
}

export function parseGoogleClientIds(env: Env): string[] {
  const ids = new Set<string>();
  if (env.GOOGLE_CLIENT_ID) ids.add(env.GOOGLE_CLIENT_ID);
  if (env.GOOGLE_CLIENT_IDS) {
    for (const id of env.GOOGLE_CLIENT_IDS.split(",")) {
      const trimmed = id.trim();
      if (trimmed) ids.add(trimmed);
    }
  }
  return [...ids];
}

export function getJwtSecretForSigning(env: Env): string {
  const secret = resolveJwtSecret(env);
  if (!secret) {
    throw new Error("JWT_SECRET is required for authentication");
  }
  return secret;
}
