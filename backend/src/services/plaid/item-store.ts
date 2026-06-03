import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { AppError } from "../../lib/errors.js";
import { accounts, plaidItems, users } from "../../db/schema.js";
import {
  createOperationTimer,
  logOperation,
  logOperationError,
} from "../../lib/operation-log.js";
import { createLogger } from "../../lib/logger.js";
import { decryptPlaidToken, encryptPlaidToken } from "./crypto.js";
import { syncPlaidItem, type PlaidSyncOptions } from "./sync.js";

const log = createLogger("plaid.item-store");

export type PlaidConnectionStatus = "active" | "error" | "reauth_required";

export interface SyncAllPlaidOptions extends PlaidSyncOptions {
  userEmail?: string | null;
}

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
    await db
      .update(accounts)
      .set({ status: "active" })
      .where(eq(accounts.plaidItemId, existing[0].id));
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

export async function setPlaidItemStatusByPlaidId(
  plaidItemId: string,
  status: PlaidConnectionStatus,
): Promise<boolean> {
  const db = getDb();
  const [item] = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.plaidItemId, plaidItemId))
    .limit(1);

  if (!item) {
    return false;
  }

  await db
    .update(plaidItems)
    .set({ status })
    .where(eq(plaidItems.id, item.id));
  await db
    .update(accounts)
    .set({ status })
    .where(eq(accounts.plaidItemId, item.id));

  return true;
}

export async function getPlaidItemAccessToken(
  itemDbId: string,
  userId: string,
  env: Env,
): Promise<string> {
  const db = getDb();
  const [item] = await db
    .select({
      accessTokenEncrypted: plaidItems.accessTokenEncrypted,
    })
    .from(plaidItems)
    .where(and(eq(plaidItems.id, itemDbId), eq(plaidItems.userId, userId)))
    .limit(1);

  if (!item) {
    throw AppError.notFound("Plaid item not found");
  }

  return decryptPlaidToken(item.accessTokenEncrypted, env);
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

export async function syncAllPlaidItems(
  userId: string,
  env: Env,
  options: SyncAllPlaidOptions = {},
) {
  const operationId = options.operationId ?? randomUUID();
  const trigger = options.trigger ?? "sync_all";
  const elapsed = createOperationTimer();
  const db = getDb();
  const items = await listPlaidItems(userId);

  const [userRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const userEmail = options.userEmail ?? userRow?.email ?? null;

  logOperation(log, "started", "Plaid sync-all started for user", {
    operation: "plaid.sync_all",
    operationId,
    trigger,
    requestId: options.requestId,
    userId,
    userEmail,
    itemCount: items.length,
    items: items.map((item) => ({
      itemDbId: item.id,
      plaidItemId: item.plaidItemId,
      institutionName: item.institutionName,
      lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
    })),
  });

  const results = [];
  const failures: {
    itemId: string;
    institutionName: string | null;
    message: string;
  }[] = [];

  let itemIndex = 0;
  for (const item of items) {
    itemIndex += 1;
    logOperation(log, "item_loaded", "Syncing Plaid item for user", {
      operation: "plaid.sync_all",
      operationId,
      trigger,
      userId,
      userEmail,
      itemDbId: item.id,
      plaidItemId: item.plaidItemId,
      institutionName: item.institutionName,
      itemIndex,
      itemCount: items.length,
    });

    try {
      results.push(
        await syncPlaidItem(item.id, env, {
          operationId,
          trigger,
          requestId: options.requestId,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Plaid sync failed";
      logOperationError(
        log,
        "failed",
        "Plaid item sync failed during sync-all",
        {
          operation: "plaid.sync_all",
          operationId,
          userId,
          userEmail,
          itemDbId: item.id,
          plaidItemId: item.plaidItemId,
          institutionName: item.institutionName,
          itemIndex,
        },
        error,
      );
      failures.push({
        itemId: item.plaidItemId,
        institutionName: item.institutionName,
        message,
      });
    }
  }

  const summary = {
    status:
      failures.length > 0
        ? results.length > 0
          ? ("partial" as const)
          : ("failed" as const)
        : ("completed" as const),
    itemsSynced: results.length,
    added: results.reduce((sum, row) => sum + row.added, 0),
    modified: results.reduce((sum, row) => sum + row.modified, 0),
    removed: results.reduce((sum, row) => sum + row.removed, 0),
    results,
    failures: failures.length > 0 ? failures : undefined,
  };

  if (results.length === 0 && failures.length > 0) {
    logOperationError(
      log,
      "failed",
      "Plaid sync-all finished with no successful items",
      {
        operation: "plaid.sync_all",
        operationId,
        userId,
        userEmail,
        failureCount: failures.length,
        durationMs: elapsed(),
      },
      failures[0]!.message,
    );
    const first = failures[0]!;
    const label = first.institutionName ?? first.itemId;
    throw AppError.plaidSyncError(`${label}: ${first.message}`);
  }

  logOperation(
    log,
    summary.status === "partial" ? "completed" : "completed",
    summary.status === "partial"
      ? "Plaid sync-all completed with some failures"
      : "Plaid sync-all completed successfully",
    {
      operation: "plaid.sync_all",
      operationId,
      userId,
      userEmail,
      itemsSynced: summary.itemsSynced,
      added: summary.added,
      modified: summary.modified,
      removed: summary.removed,
      failureCount: failures.length,
      failures: failures.length > 0 ? failures : undefined,
      durationMs: elapsed(),
    },
  );

  return summary;
}

export async function exchangeAndSync(
  userId: string,
  plaidItemId: string,
  accessToken: string,
  env: Env,
  options: PlaidSyncOptions = {},
) {
  const item = await createPlaidItemFromExchange(
    userId,
    plaidItemId,
    accessToken,
    env,
  );
  const syncResult = await syncPlaidItem(item.id, env, {
    ...options,
    trigger: options.trigger ?? "link_exchange",
  });
  return { item, syncResult };
}
