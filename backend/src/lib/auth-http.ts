import type { FastifyRequest } from "fastify";
import type { Env } from "../config/env.js";
import { AppError } from "./errors.js";
import { resolveRequestUser } from "../services/auth/request-user.js";
import type { UserRecord } from "../services/auth/user-auth.js";

export async function requireRequestUser(
  request: FastifyRequest,
  env: Env,
): Promise<UserRecord> {
  const user = await resolveRequestUser(request, env);
  if (!user) {
    throw AppError.unauthenticated();
  }
  request.log.debug({ userId: user.id }, "authenticated request");
  return user;
}
