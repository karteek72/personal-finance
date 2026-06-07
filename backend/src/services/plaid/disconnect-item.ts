import { and, eq } from "drizzle-orm";
import type { Env } from "../../config/env.js";
import { getDb } from "../../db/client.js";
import { accounts, plaidItems } from "../../db/schema.js";
import { createLogger } from "../../lib/logger.js";
import { getPlaidClient } from "./client.js";
import { purgeDerivedFinancialData } from "../purge-derived-financial-data.js";
import { decryptPlaidToken } from "./crypto.js";

const log = createLogger("plaid.disconnect");

/**
 * Revokes the Plaid item (best effort) and removes all local accounts and the item row.
 */
export async function disconnectPlaidItem(
  itemDbId: string,
  userId: string,
  env: Env,
): Promise<boolean> {
  const db = getDb();
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(and(eq(plaidItems.id, itemDbId), eq(plaidItems.userId, userId)))
    .limit(1);

  if (!item) {
    return false;
  }

  try {
    const accessToken = decryptPlaidToken(item.accessTokenEncrypted, env);
    const client = getPlaidClient(env);
    await client.itemRemove({ access_token: accessToken });
    log.info(
      { itemDbId, userId, plaidItemId: item.plaidItemId },
      "Plaid item removed via API",
    );
  } catch (err) {
    log.error(
      { err, itemDbId, userId, plaidItemId: item.plaidItemId },
      "Plaid itemRemove failed; deleting local Plaid item and accounts",
    );
  }

  await db.delete(accounts).where(eq(accounts.plaidItemId, itemDbId));
  await db
    .delete(plaidItems)
    .where(and(eq(plaidItems.id, itemDbId), eq(plaidItems.userId, userId)));

  await purgeDerivedFinancialData(userId);

  return true;
}
