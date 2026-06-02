import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, transactions } from "../db/schema.js";

export async function getAccount(accountId: string, userId: string) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  return account ?? null;
}

export async function deleteAccount(accountId: string, userId: string) {
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

  await db.delete(accounts).where(eq(accounts.id, accountId));

  return {
    id: account.id,
    name: account.name,
    mask: account.mask,
    transactionsDeleted: countRow?.count ?? 0,
  };
}
