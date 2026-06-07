import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { transactions } from "../../db/schema.js";
import { formatMoneyAmount } from "../../lib/money.js";
import { categoryMeta } from "../category-meta.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "../active-account-scope.js";
import type { BudgetClass } from "./planning-crud.js";

const SUGGESTION_LOOKBACK_MONTHS = 6;
const MIN_MONTHLY_THRESHOLD = 50;
const MIN_MONTHS_FOR_QUALIFY = 2;
const BUFFER_MULTIPLIER = 1.1;

const ESSENTIAL_CATEGORIES = new Set<string>([
  "Food & Groceries",
  "Housing & Home",
  "Utilities & Bills",
  "Transportation",
  "Health & Medical",
  "Financial & Insurance",
  "Education",
  "Family & Kids",
  "Personal Care",
]);

export type SuggestionConfidence = "low" | "medium" | "high";

export interface SuggestedBudgetItem {
  category: string;
  emoji: string | null;
  color: string | null;
  spent: string;
  limit: string;
  source: "suggested";
  class: BudgetClass | null;
  rationale: string;
  confidence: SuggestionConfidence;
}

function monthBounds(period: string): { start: string; end: string } {
  const [y, mo] = period.split("-").map(Number);
  const lastDay = new Date(y!, mo!, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

function priorMonths(anchorPeriod: string, count: number): string[] {
  const [y, mo] = anchorPeriod.split("-").map(Number);
  const months: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const d = new Date(y!, mo! - 1 - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return months;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function roundBudgetLimit(amount: number): number {
  if (amount <= 0) return 0;
  if (amount < 100) return Math.ceil(amount / 5) * 5;
  if (amount < 500) return Math.ceil(amount / 10) * 10;
  if (amount < 1000) return Math.ceil(amount / 25) * 25;
  return Math.ceil(amount / 50) * 50;
}

function confidenceFromMonthCount(count: number): SuggestionConfidence {
  if (count >= 5) return "high";
  if (count >= 3) return "medium";
  return "low";
}

function budgetClassForCategory(category: string): BudgetClass | null {
  if (ESSENTIAL_CATEGORIES.has(category)) return "essential";
  return "discretionary";
}

function qualifiesCategory(monthlyTotals: number[]): boolean {
  const monthsWithSpend = monthlyTotals.filter((v) => v > 0).length;
  const maxMonth = Math.max(...monthlyTotals, 0);
  return monthsWithSpend >= MIN_MONTHS_FOR_QUALIFY || maxMonth >= MIN_MONTHLY_THRESHOLD;
}

export async function buildSuggestedBudgets(
  userIds: string[],
  period: string,
  budgetedCategories: Set<string>,
  spentByCategory: Map<string, number>,
): Promise<SuggestedBudgetItem[]> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) {
    return [];
  }

  const lookbackMonths = priorMonths(period, SUGGESTION_LOOKBACK_MONTHS);
  const earliest = monthBounds(lookbackMonths[lookbackMonths.length - 1]!).start;
  const latest = monthBounds(lookbackMonths[0]!).end;

  const db = getDb();
  const rows = await db
    .select({
      category: transactions.category,
      month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
        gte(transactions.date, earliest),
        lte(transactions.date, latest),
      ),
    )
    .groupBy(transactions.category, sql`to_char(${transactions.date}::date, 'YYYY-MM')`);

  const totalsByCategory = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const byMonth = totalsByCategory.get(row.category) ?? new Map<string, number>();
    byMonth.set(row.month, Number.parseFloat(row.total ?? "0"));
    totalsByCategory.set(row.category, byMonth);
  }

  const suggestions: SuggestedBudgetItem[] = [];
  for (const [category, byMonth] of totalsByCategory) {
    if (budgetedCategories.has(category)) continue;

    const monthlyTotals = lookbackMonths.map((m) => byMonth.get(m) ?? 0);
    if (!qualifiesCategory(monthlyTotals)) continue;

    const monthsWithData = monthlyTotals.filter((v) => v > 0).length;
    const baseline = median(monthlyTotals);
    const limit = roundBudgetLimit(Math.max(baseline * BUFFER_MULTIPLIER, 0));
    if (limit <= 0) continue;

    const meta = categoryMeta(category);
    const spent = spentByCategory.get(category) ?? 0;
    const avgDisplay = formatMoneyAmount(baseline);
    suggestions.push({
      category,
      emoji: meta.emoji,
      color: meta.color,
      spent: formatMoneyAmount(spent),
      limit: formatMoneyAmount(limit),
      source: "suggested",
      class: budgetClassForCategory(category),
      rationale: `Median ${avgDisplay}/mo over ${monthsWithData} of ${SUGGESTION_LOOKBACK_MONTHS} months, +10% buffer`,
      confidence: confidenceFromMonthCount(monthsWithData),
    });
  }

  return suggestions.sort(
    (a, b) => Number.parseFloat(b.spent) - Number.parseFloat(a.spent),
  );
}
