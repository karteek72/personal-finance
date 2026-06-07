import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, transactions } from "../db/schema.js";

export async function getActiveAccountIds(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) {
    return [];
  }
  const db = getDb();
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)),
    );
  return rows.map((row) => row.id);
}

/** SQL fragment: `false` when there are no active accounts. */
export function sqlActiveAccountIdsIn(
  accountIds: string[],
  column = "account_id",
): SQL {
  if (accountIds.length === 0) {
    return sql`false`;
  }
  if (column === "account_id") {
    return sql`account_id IN (${sql.join(
      accountIds.map((id) => sql`${id}`),
      sql`, `,
    )})`;
  }
  return sql`${sql.raw(column)} IN (${sql.join(
    accountIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

export function activeTransactionFilter(
  userIds: string[],
  accountIds: string[],
): SQL {
  if (accountIds.length === 0) {
    return sql`false`;
  }
  const userFilter =
    userIds.length === 1
      ? sql`${transactions.userId} = ${userIds[0]!}`
      : sql`${transactions.userId} IN (${sql.join(
          userIds.map((id) => sql`${id}`),
          sql`, `,
        )})`;
  return sql`${userFilter} AND ${sqlActiveAccountIdsIn(accountIds)}`;
}

export function drizzleActiveTransactionWhere(
  userIds: string[],
  accountIds: string[],
) {
  if (accountIds.length === 0) {
    return sql`false`;
  }
  return and(
    userIds.length === 1
      ? eq(transactions.userId, userIds[0]!)
      : inArray(transactions.userId, userIds),
    inArray(transactions.accountId, accountIds),
  );
}

export async function resolveActiveAccountScope(userIds: string[]): Promise<{
  accountIds: string[];
  hasActiveAccounts: boolean;
}> {
  const accountIds = await getActiveAccountIds(userIds);
  return {
    accountIds,
    hasActiveAccounts: accountIds.length > 0,
  };
}
