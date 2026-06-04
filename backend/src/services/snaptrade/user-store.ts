import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { snaptradeUsers } from "../../db/schema.js";
import { getSnaptradeClient } from "./client.js";
import { decryptSnaptradeSecret, encryptSnaptradeSecret } from "./crypto.js";

export interface SnaptradeCredentials {
  snaptradeUserId: string;
  userSecret: string;
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

  const snaptradeUserId = spendflowUserId;
  const client = getSnaptradeClient(env);
  const response = await client.authentication.registerSnapTradeUser({
    userId: snaptradeUserId,
  });

  const userSecret = response.data.userSecret;
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
