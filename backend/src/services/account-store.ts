import { and, eq, inArray, sql } from "drizzle-orm";
import type { Env } from "../config/env.js";
import { getDb } from "../db/client.js";
import { accounts, transactions } from "../db/schema.js";
import { resolveHouseholdContext } from "./household-access.js";
import { disconnectPlaidItem } from "./plaid/disconnect-item.js";

export interface DeleteAccountResult {
  id: string;
  name: string;
  mask: string;
  transactionsDeleted: number;
  plaidItemDisconnected: boolean;
}

export async function getAccount(accountId: string, userId: string) {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        inArray(accounts.userId, ctx.userIds),
      ),
    )
    .limit(1);
  return account ?? null;
}

export async function deleteAccount(
  accountId: string,
  userId: string,
  env: Env,
): Promise<DeleteAccountResult | null> {
  const db = getDb();

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!account) {
    return null;
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(eq(transactions.accountId, accountId));

  const plaidItemId = account.plaidItemId;

  await db.delete(accounts).where(eq(accounts.id, accountId));

  let plaidItemDisconnected = false;
  if (plaidItemId) {
    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts)
      .where(
        and(
          eq(accounts.plaidItemId, plaidItemId),
          eq(accounts.userId, userId),
        ),
      );

    if ((remaining?.count ?? 0) === 0) {
      plaidItemDisconnected = await disconnectPlaidItem(
        plaidItemId,
        userId,
        env,
      );
    }
  }

  return {
    id: account.id,
    name: account.name,
    mask: account.mask,
    transactionsDeleted: countRow?.count ?? 0,
    plaidItemDisconnected,
  };
}
