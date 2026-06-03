import { and, desc, eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { plaidItems } from "../../db/schema.js";
import { encryptPlaidToken } from "./crypto.js";
import { createLogger } from "../../lib/logger.js";
import { syncPlaidItem } from "./sync.js";

const log = createLogger("plaid.item-store");

export async function createPlaidItemFromExchange(
  userId: string,
  plaidItemId: string,
  accessToken: string,
  env: Env,
) {
  const db = getDb();
  const encrypted = encryptPlaidToken(accessToken, env);

  const existing = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.plaidItemId, plaidItemId))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(plaidItems)
      .set({
        accessTokenEncrypted: encrypted,
        status: "active",
      })
      .where(eq(plaidItems.id, existing[0].id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(plaidItems)
    .values({
      userId,
      plaidItemId,
      accessTokenEncrypted: encrypted,
      status: "active",
    })
    .returning();

  return created!;
}

export async function listPlaidItems(userId: string) {
  const db = getDb();
  return db
    .select({
      id: plaidItems.id,
      plaidItemId: plaidItems.plaidItemId,
      institutionName: plaidItems.institutionName,
      status: plaidItems.status,
      lastSyncedAt: plaidItems.lastSyncedAt,
      createdAt: plaidItems.createdAt,
    })
    .from(plaidItems)
    .where(eq(plaidItems.userId, userId))
    .orderBy(desc(plaidItems.createdAt));
}

export async function deletePlaidItem(itemDbId: string, userId: string) {
  const db = getDb();
  await db
    .delete(plaidItems)
    .where(
      and(eq(plaidItems.id, itemDbId), eq(plaidItems.userId, userId)),
    );
}

export async function syncAllPlaidItems(userId: string, env: Env) {
  const items = await listPlaidItems(userId);
  const results = [];
  const failures: { itemId: string; institutionName: string | null; message: string }[] =
    [];

  for (const item of items) {
    try {
      results.push(await syncPlaidItem(item.id, env));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Plaid sync failed";
      log.error(
        { itemDbId: item.id, plaidItemId: item.plaidItemId, err: error },
        "plaid item sync failed",
      );
      failures.push({
        itemId: item.plaidItemId,
        institutionName: item.institutionName,
        message,
      });
    }
  }

  if (results.length === 0 && failures.length > 0) {
    const first = failures[0]!;
    const label = first.institutionName ?? first.itemId;
    throw AppError.plaidSyncError(`${label}: ${first.message}`);
  }

  return {
    status: failures.length > 0 ? ("partial" as const) : ("completed" as const),
    itemsSynced: results.length,
    added: results.reduce((sum, row) => sum + row.added, 0),
    modified: results.reduce((sum, row) => sum + row.modified, 0),
    removed: results.reduce((sum, row) => sum + row.removed, 0),
    results,
    failures: failures.length > 0 ? failures : undefined,
  };
}

export async function exchangeAndSync(
  userId: string,
  plaidItemId: string,
  accessToken: string,
  env: Env,
) {
  const item = await createPlaidItemFromExchange(
    userId,
    plaidItemId,
    accessToken,
    env,
  );
  const syncResult = await syncPlaidItem(item.id, env);
  return { item, syncResult };
}
