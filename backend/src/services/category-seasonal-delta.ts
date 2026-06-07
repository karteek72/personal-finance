import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { roundDecimal, roundPercent } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function trailingMonths(beforeMonth: string, count: number): string[] {
  const [yearStr, monthStr] = beforeMonth.split("-");
  let year = Number.parseInt(yearStr ?? "0", 10);
  let month = Number.parseInt(monthStr ?? "1", 10);
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    month -= 1;
    if (month <= 0) {
      month = 12;
      year -= 1;
    }
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-");
  const lastDay = new Date(Number.parseInt(year!, 10), Number.parseInt(mon!, 10), 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

async function categorySpendForMonth(
  userIds: string[],
  accountIds: string[],
  month: string,
): Promise<Map<string, number>> {
  const db = getDb();
  const { from, to } = monthBounds(month);
  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        sql`${transactions.date} >= ${from} and ${transactions.date} <= ${to}`,
      ),
    )
    .groupBy(transactions.category);

  return new Map(
    rows.map((row) => [row.category, Number.parseFloat(row.total ?? "0")]),
  );
}

async function categorySpendFromMart(
  userIds: string[],
  month: string,
): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db.execute<{ category: string; total: string }>(sql`
    SELECT category, total::text
    FROM mart_category_month
    WHERE user_id IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})
      AND month = ${month}
  `);
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.category, Number.parseFloat(row.total ?? "0"));
  }
  return map;
}

/**
 * Seasonally-adjusted category delta: (this_month / median(trailing 6mo) − 1) × 100.
 * Current month is always computed live; closed months prefer mart_category_month.
 */
export async function seasonalCategoryDeltas(
  userIds: string[],
  refMonth: string,
): Promise<Map<string, number>> {
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) return new Map();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isLiveMonth = refMonth >= currentMonth;

  const currentSpend = isLiveMonth
    ? await categorySpendForMonth(userIds, accountIds, refMonth)
    : await categorySpendFromMart(userIds, refMonth);

  const trailing = trailingMonths(refMonth, 6);
  const historyByCategory = new Map<string, number[]>();

  for (const month of trailing) {
    const monthSpend =
      month >= currentMonth
        ? await categorySpendForMonth(userIds, accountIds, month)
        : await categorySpendFromMart(userIds, month);

    for (const [category, amount] of monthSpend) {
      const list = historyByCategory.get(category) ?? [];
      if (amount > 0) list.push(amount);
      historyByCategory.set(category, list);
    }
  }

  const deltas = new Map<string, number>();
  for (const [category, current] of currentSpend) {
    const history = historyByCategory.get(category) ?? [];
    const baseline = median(history);
    if (baseline <= 0) {
      deltas.set(category, 0);
      continue;
    }
    deltas.set(category, roundPercent((current / baseline - 1) * 100));
  }

  return deltas;
}

/** Single category seasonal delta percent. */
export function seasonalDeltaPercent(
  current: number,
  trailingAmounts: number[],
): number {
  const baseline = median(trailingAmounts.filter((v) => v > 0));
  if (baseline <= 0) return 0;
  return roundPercent((current / baseline - 1) * 100);
}

export { median as medianSpend, trailingMonths };
