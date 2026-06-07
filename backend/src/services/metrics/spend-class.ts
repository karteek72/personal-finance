import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { transactions } from "../../db/schema.js";
import { formatMoneyAmount } from "../../lib/money.js";
import { drizzleActiveTransactionWhere } from "../active-account-scope.js";
import {
  categoriesForSpendClass,
  essentialCategoryNames,
  nonEssentialExpenseCategoryNames,
} from "../dim-category-store.js";
import { INTERNAL_TRANSFER_CATEGORY } from "../transfer-classification.js";
import { buildMetricEnvelope, type MetricEnvelope } from "./types.js";

export interface SpendClassBreakdown {
  fixed: string;
  variable: string;
  discretionary: string;
  essential: string;
  nonEssential: string;
}

function monthBounds(period: string): { start: string; end: string } {
  const [y, mo] = period.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

async function sumOutflowByCategories(
  userIds: string[],
  accountIds: string[],
  categories: string[],
  start: string,
  end: string,
): Promise<number> {
  if (categories.length === 0 || accountIds.length === 0) return 0;

  const db = getDb();
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
        inArray(transactions.category, categories),
        sql`${transactions.date} >= ${start} and ${transactions.date} <= ${end}`,
      ),
    );

  return Number.parseFloat(row?.total ?? "0");
}

/** Fixed / variable / discretionary and essential splits for a calendar month. */
export async function spendClassBreakdownForPeriod(
  userIds: string[],
  accountIds: string[],
  period: string,
): Promise<SpendClassBreakdown> {
  const { start, end } = monthBounds(period);
  const [fixedCats, variableCats, discretionaryCats, essentialCats, nonEssentialCats] =
    await Promise.all([
      categoriesForSpendClass("fixed"),
      categoriesForSpendClass("variable"),
      categoriesForSpendClass("discretionary"),
      essentialCategoryNames(),
      nonEssentialExpenseCategoryNames(),
    ]);

  const [fixed, variable, discretionary, essential, nonEssential] =
    await Promise.all([
      sumOutflowByCategories(userIds, accountIds, fixedCats, start, end),
      sumOutflowByCategories(userIds, accountIds, variableCats, start, end),
      sumOutflowByCategories(userIds, accountIds, discretionaryCats, start, end),
      sumOutflowByCategories(userIds, accountIds, essentialCats, start, end),
      sumOutflowByCategories(userIds, accountIds, nonEssentialCats, start, end),
    ]);

  return {
    fixed: formatMoneyAmount(fixed),
    variable: formatMoneyAmount(variable),
    discretionary: formatMoneyAmount(discretionary),
    essential: formatMoneyAmount(essential),
    nonEssential: formatMoneyAmount(nonEssential),
  };
}

export interface DiscretionaryShareMetricInput {
  discretionaryOutflow: number;
  totalOutflow: number;
  asOf: string;
  confidence?: number;
}

/** Discretionary share of total outflow (0–1 ratio envelope). */
export function discretionaryShareMetric(
  input: DiscretionaryShareMetricInput,
): MetricEnvelope {
  const ratio =
    input.totalOutflow > 0
      ? input.discretionaryOutflow / input.totalOutflow
      : 0;
  const caveats: string[] = [];
  if (input.totalOutflow <= 0) {
    caveats.push("No outflow in period");
  }

  return buildMetricEnvelope({
    value: ratio,
    unit: "ratio",
    asOf: input.asOf,
    class: "diagnostic",
    basis: "factual",
    confidence: input.confidence ?? 0.85,
    caveats: caveats.length > 0 ? caveats : undefined,
  });
}

export async function discretionaryOutflowForPeriod(
  userIds: string[],
  accountIds: string[],
  period: string,
): Promise<{ discretionary: number; total: number }> {
  const discretionaryCats = await categoriesForSpendClass("discretionary");
  const { start, end } = monthBounds(period);
  const discretionary = await sumOutflowByCategories(
    userIds,
    accountIds,
    discretionaryCats,
    start,
    end,
  );

  const db = getDb();
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
        sql`${transactions.date} >= ${start} and ${transactions.date} <= ${end}`,
      ),
    );

  return {
    discretionary,
    total: Number.parseFloat(row?.total ?? "0"),
  };
}
