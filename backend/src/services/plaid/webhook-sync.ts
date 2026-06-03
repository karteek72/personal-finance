import { eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { plaidItems } from "../../db/schema.js";
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

export async function syncPlaidItemByPlaidItemId(
  plaidItemId: string,
  env: Env,
): Promise<void> {
  const db = getDb();
  const [item] = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.plaidItemId, plaidItemId))
    .limit(1);

  if (!item) {
    log.warn({ plaidItemId }, "webhook item_id not found in database");
    return;
  }

  const result = await syncPlaidItem(item.id, env);
  log.info(
    {
      plaidItemId,
      added: result.added,
      modified: result.modified,
      removed: result.removed,
    },
    "webhook-triggered plaid sync completed",
  );
}

export async function handlePlaidWebhookPayload(
  payload: PlaidWebhookPayload,
  env: Env,
): Promise<void> {
  if (payload.webhook_type !== "TRANSACTIONS") {
    return;
  }

  if (!payload.webhook_code || !payload.item_id) {
    return;
  }

  if (!TRANSACTIONS_SYNC_CODES.has(payload.webhook_code)) {
    return;
  }

  log.info(
    { itemId: payload.item_id, code: payload.webhook_code },
    "plaid transactions webhook received",
  );

  await syncPlaidItemByPlaidItemId(payload.item_id, env);
}
