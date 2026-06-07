import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { transactions } from "../../db/schema.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "../active-account-scope.js";
import { essentialCategoryNames } from "../dim-category-store.js";
import { INTERNAL_TRANSFER_CATEGORY } from "../transfer-classification.js";

export interface PeriodCashflowTotals {
  income: number;
  expense: number;
  essentialExpense: number;
}

function monthBounds(period: string): { start: string; end: string } {
  const [y, mo] = period.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

function monthsBeforeEnd(endDate: string, count: number): string {
  const [y, m, d] = endDate.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCMonth(date.getUTCMonth() - count);
  return date.toISOString().slice(0, 10);
}

/** Income, total expense, and essential expense for a calendar month. */
export async function monthCashflowTotals(
  userIds: string[],
  accountIds: string[],
  period: string,
): Promise<PeriodCashflowTotals> {
  const db = getDb();
  const { start, end } = monthBounds(period);
  const essentialList = await essentialCategoryNames();

  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'income' and ${transactions.isTransfer} = false then abs(${transactions.amount}::numeric) else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false and ${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY} then ${transactions.amount}::numeric else 0 end), 0)`,
      essentialExpense: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false and ${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY} and ${transactions.category} in (${sql.join(
        essentialList.map((c) => sql`${c}`),
        sql`, `,
      )}) then ${transactions.amount}::numeric else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        sql`${transactions.date} >= ${start} and ${transactions.date} <= ${end}`,
      ),
    );

  return {
    income: Number.parseFloat(row?.income ?? "0"),
    expense: Number.parseFloat(row?.expense ?? "0"),
    essentialExpense: Number.parseFloat(row?.essentialExpense ?? "0"),
  };
}

/** Trailing essential outflow ending on endDate (inclusive). */
export async function trailingEssentialOutflow(
  userIds: string[],
  accountIds: string[],
  endDate: string,
  lookbackMonths = 3,
): Promise<{ total: number; months: number }> {
  if (accountIds.length === 0) {
    return { total: 0, months: lookbackMonths };
  }

  const db = getDb();
  const startDate = monthsBeforeEnd(endDate, lookbackMonths);
  const essentialList = await essentialCategoryNames();

  const [row] = await db
    .select({
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
        inArray(transactions.category, essentialList),
        sql`${transactions.date} >= ${startDate} and ${transactions.date} <= ${endDate}`,
      ),
    );

  return {
    total: Number.parseFloat(row?.total ?? "0"),
    months: lookbackMonths,
  };
}

/** Resolve active account scope and return account IDs for metric queries. */
export async function resolveMetricAccountIds(
  userIds: string[],
): Promise<{ accountIds: string[]; hasActiveAccounts: boolean }> {
  return resolveActiveAccountScope(userIds);
}
