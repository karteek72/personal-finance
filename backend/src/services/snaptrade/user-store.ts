import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { snaptradeUsers } from "../../db/schema.js";
import { getSnaptradeClient } from "./client.js";
import { decryptSnaptradeSecret, encryptSnaptradeSecret } from "./crypto.js";
import { toSnaptradeAppError } from "./errors.js";

export interface SnaptradeCredentials {
  snaptradeUserId: string;
  userSecret: string;
}

function resolveSharedSnaptradeCredentials(env: Env): SnaptradeCredentials | null {
  const snaptradeUserId = env.SNAPTRADE_SHARED_USER_ID?.trim();
  const userSecret = env.SNAPTRADE_SHARED_USER_SECRET?.trim();
  if (!snaptradeUserId || !userSecret) return null;
  return { snaptradeUserId, userSecret };
}

export async function ensureSnaptradeUser(
  spendflowUserId: string,
  env: Env,
): Promise<SnaptradeCredentials> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.userId, spendflowUserId))
    .limit(1);

  if (existing) {
    return {
      snaptradeUserId: existing.snaptradeUserId,
      userSecret: decryptSnaptradeSecret(existing.userSecretEncrypted, env),
    };
  }

  const shared = resolveSharedSnaptradeCredentials(env);
  if (shared) {
    await db.insert(snaptradeUsers).values({
      userId: spendflowUserId,
      snaptradeUserId: shared.snaptradeUserId,
      userSecretEncrypted: encryptSnaptradeSecret(shared.userSecret, env),
    });
    return shared;
  }

  const snaptradeUserId = spendflowUserId;
  const client = getSnaptradeClient(env);

  let userSecret: string;
  try {
    const response = await client.authentication.registerSnapTradeUser({
      userId: snaptradeUserId,
    });
    userSecret = response.data.userSecret ?? "";
  } catch (error) {
    throw toSnaptradeAppError(error, "Unable to register SnapTrade user");
  }

  if (!userSecret) {
    throw new Error("SnapTrade registerUser did not return userSecret");
  }

  await db.insert(snaptradeUsers).values({
    userId: spendflowUserId,
    snaptradeUserId,
    userSecretEncrypted: encryptSnaptradeSecret(userSecret, env),
  });

  return { snaptradeUserId, userSecret };
}

export async function getSnaptradeCredentials(
  spendflowUserId: string,
  env: Env,
): Promise<SnaptradeCredentials> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(snaptradeUsers)
    .where(eq(snaptradeUsers.userId, spendflowUserId))
    .limit(1);

  if (!row) {
    return ensureSnaptradeUser(spendflowUserId, env);
  }

  return {
    snaptradeUserId: row.snaptradeUserId,
    userSecret: decryptSnaptradeSecret(row.userSecretEncrypted, env),
  };
}
