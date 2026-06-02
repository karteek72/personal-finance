import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../config/env.js";
import { resolveRequestUser } from "../services/auth/request-user.js";
import type { UserRecord } from "../services/auth/user-auth.js";

export async function requireRequestUser(
  request: FastifyRequest,
  reply: FastifyReply,
  env: Env,
): Promise<UserRecord | null> {
  const user = await resolveRequestUser(request, env);
  if (!user) {
    await reply.status(401).send({
      error: { code: "UNAUTHENTICATED", message: "Sign in required" },
    });
    return null;
  }
  return user;
}
