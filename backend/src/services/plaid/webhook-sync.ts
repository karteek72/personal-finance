import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { plaidItems } from "../../db/schema.js";
import { logOperation, logOperationWarn } from "../../lib/operation-log.js";
import { createLogger } from "../../lib/logger.js";
import { syncPlaidItem } from "./sync.js";

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

export async function handlePlaidWebhookPayload(
  payload: PlaidWebhookPayload,
  env: Env,
): Promise<void> {
  if (!payload.webhook_code || !payload.item_id) {
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

    await syncPlaidItemByPlaidItemId(
      payload.item_id,
      env,
      payload.webhook_code,
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

  await syncPlaidItemByPlaidItemId(
    payload.item_id,
    env,
    payload.webhook_code,
  );
}
