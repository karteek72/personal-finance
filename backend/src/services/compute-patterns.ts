import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import type { PatternsResponse } from "./insights-store.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function computePatternsFromTransactions(
  userIds: string[],
): Promise<PatternsResponse> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);

  if (!hasActiveAccounts) {
    return { dayOfWeek: [], patterns: [] };
  }

  const db = getDb();
  const baseWhere = drizzleActiveTransactionWhere(userIds, accountIds);

  const dowRows = await db
    .select({
      dow: sql<number>`extract(dow from ${transactions.date})::int`,
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        baseWhere,
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        eq(transactions.pending, false),
      ),
    )
    .groupBy(sql`extract(dow from ${transactions.date})`);

  const dowTotals = new Map<number, number>();
  for (const row of dowRows) {
    dowTotals.set(row.dow, Number.parseFloat(row.total ?? "0"));
  }

  const dayOfWeek = DOW_LABELS.map((day, index) => ({
    day,
    value: formatMoneyAmount(dowTotals.get(index) ?? 0),
  }));

  const categoryRows = await db
    .select({
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        baseWhere,
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        eq(transactions.pending, false),
      ),
    )
    .groupBy(transactions.category)
    .orderBy(sql`sum(${transactions.amount}::numeric) desc`)
    .limit(5);

  const patterns = categoryRows.map((row) => ({
    label: row.category,
    value: formatMoneyAmount(row.total ?? "0"),
    description: `${row.count} transactions in this category`,
    severity: "neutral" as const,
  }));

  return { dayOfWeek, patterns };
}
