import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { plaidItems } from "../../db/schema.js";
import { enqueuePlaidSync, isRedisConfigured } from "../../jobs/queue.js";
import { logOperation, logOperationWarn } from "../../lib/operation-log.js";
import { createLogger } from "../../lib/logger.js";
import { syncPlaidItem } from "./sync.js";
import {
  setPlaidItemStatusByPlaidId,
  type PlaidConnectionStatus,
} from "./item-store.js";

const log = createLogger("plaid.webhook");

/** Plaid webhook payload (subset we handle). */
export interface PlaidWebhookPayload {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
}

const TRANSACTIONS_SYNC_CODES = new Set([
  "SYNC_UPDATES_AVAILABLE",
  "INITIAL_UPDATE",
  "HISTORICAL_UPDATE",
  "DEFAULT_UPDATE",
]);

const LIABILITIES_SYNC_CODES = new Set(["DEFAULT_UPDATE"]);

const ITEM_REAUTH_CODES = new Set([
  "ERROR",
  "PENDING_EXPIRATION",
  "PENDING_DISCONNECT",
]);

const ITEM_ERROR_CODES = new Set(["USER_PERMISSION_REVOKED"]);

const ITEM_RECOVERY_CODES = new Set(["LOGIN_REPAIRED"]);

export async function syncPlaidItemByPlaidItemId(
  plaidItemId: string,
  env: Env,
  webhookCode: string,
): Promise<void> {
  const operationId = randomUUID();
  const db = getDb();
  const [item] = await db
    .select({ id: plaidItems.id, userId: plaidItems.userId })
    .from(plaidItems)
    .where(eq(plaidItems.plaidItemId, plaidItemId))
    .limit(1);

  if (!item) {
    logOperationWarn(
      log,
      "skipped",
      "Plaid webhook item_id not found in database — sync skipped",
      {
        operation: "plaid.webhook_sync",
        operationId,
        plaidItemId,
        webhookCode,
      },
    );
    return;
  }

  await syncPlaidItem(item.id, env, {
    operationId,
    trigger: `webhook:${webhookCode}`,
  });
}

async function dispatchPlaidSync(
  plaidItemId: string,
  env: Env,
  webhookCode: string,
  webhookType: string,
): Promise<void> {
  const operationId = randomUUID();

  if (isRedisConfigured(env)) {
    const enqueued = await enqueuePlaidSync(env, { plaidItemId, webhookCode });
    if (enqueued) {
      logOperation(log, "queued", "Plaid sync job enqueued", {
        operation: "plaid.webhook_sync",
        operationId,
        plaidItemId,
        webhookCode,
        trigger: `webhook:${webhookCode}`,
        webhookType,
      });
      return;
    }
  }

  await syncPlaidItemByPlaidItemId(plaidItemId, env, webhookCode);
}

function resolveItemWebhookStatus(webhookCode: string): PlaidConnectionStatus | null {
  if (ITEM_REAUTH_CODES.has(webhookCode)) {
    return "reauth_required";
  }
  if (ITEM_ERROR_CODES.has(webhookCode)) {
    return "error";
  }
  return null;
}

async function handleItemWebhook(
  payload: PlaidWebhookPayload,
  env: Env,
): Promise<void> {
  const plaidItemId = payload.item_id!;
  const webhookCode = payload.webhook_code!;
  const operationId = randomUUID();

  if (ITEM_RECOVERY_CODES.has(webhookCode)) {
    logOperation(log, "started", "Plaid item login repaired — resetting status", {
      operation: "plaid.webhook_item",
      operationId,
      plaidItemId,
      webhookCode,
    });
    await setPlaidItemStatusByPlaidId(plaidItemId, "active");
    await dispatchPlaidSync(plaidItemId, env, webhookCode, "ITEM");
    return;
  }

  const status = resolveItemWebhookStatus(webhookCode);
  if (!status) {
    return;
  }

  const updated = await setPlaidItemStatusByPlaidId(plaidItemId, status);
  logOperation(
    log,
    updated ? "completed" : "skipped",
    updated
      ? "Plaid item marked with connection status from ITEM webhook"
      : "Plaid ITEM webhook item_id not found in database",
    {
      operation: "plaid.webhook_item",
      operationId,
      plaidItemId,
      webhookCode,
      status,
    },
  );
}

export async function handlePlaidWebhookPayload(
  payload: PlaidWebhookPayload,
  env: Env,
): Promise<void> {
  if (!payload.webhook_code || !payload.item_id) {
    return;
  }

  if (payload.webhook_type === "ITEM") {
    await handleItemWebhook(payload, env);
    return;
  }

  if (
    payload.webhook_type === "LIABILITIES" &&
    LIABILITIES_SYNC_CODES.has(payload.webhook_code)
  ) {
    logOperation(log, "started", "Plaid liabilities webhook received", {
      operation: "plaid.webhook_sync",
      operationId: randomUUID(),
      plaidItemId: payload.item_id,
      webhookCode: payload.webhook_code,
      trigger: `webhook:${payload.webhook_code}`,
    });

    await dispatchPlaidSync(
      payload.item_id,
      env,
      payload.webhook_code,
      payload.webhook_type,
    );
    return;
  }

  if (payload.webhook_type !== "TRANSACTIONS") {
    return;
  }

  if (!TRANSACTIONS_SYNC_CODES.has(payload.webhook_code)) {
    return;
  }

  logOperation(log, "started", "Plaid transactions webhook received", {
    operation: "plaid.webhook_sync",
    operationId: randomUUID(),
    plaidItemId: payload.item_id,
    webhookCode: payload.webhook_code,
    trigger: `webhook:${payload.webhook_code}`,
  });

  await dispatchPlaidSync(
    payload.item_id,
    env,
    payload.webhook_code,
    payload.webhook_type ?? "TRANSACTIONS",
  );
}
