import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  inflationCategories,
  inflationProfiles,
  resilienceProfiles,
  resilienceScenarios,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { averageMonthlyCashSpending } from "./investment-analytics.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

const NATIONAL_CPI = 3.1;
const DEFAULT_RAISE_PERCENT = 3.0;
const LOOKBACK_MONTHS = 12;

const CATEGORY_INFLATION: Record<
  string,
  { rate: number; severity: "high" | "medium" | "low" }
> = {
  "Housing & Home": { rate: 3.0, severity: "medium" },
  "Food & Groceries": { rate: 3.8, severity: "high" },
  "Dining & Restaurants": { rate: 4.2, severity: "high" },
  Transportation: { rate: 2.4, severity: "low" },
  "Health & Medical": { rate: 4.1, severity: "high" },
  "Utilities & Bills": { rate: 3.3, severity: "medium" },
  "Subscriptions & Software": { rate: 5.0, severity: "high" },
  "Shopping & Retail": { rate: 1.9, severity: "low" },
  Travel: { rate: 2.7, severity: "low" },
  Entertainment: { rate: 2.5, severity: "low" },
  Education: { rate: 4.5, severity: "high" },
  "Financial & Insurance": { rate: 3.2, severity: "medium" },
};

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function inflationForCategory(name: string): {
  rate: number;
  severity: "high" | "medium" | "low";
} {
  return CATEGORY_INFLATION[name] ?? { rate: NATIONAL_CPI, severity: "medium" };
}

async function sumDepositoryCash(userIds: string[]): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      balance: accounts.balanceAvailable,
      current: accounts.balanceCurrent,
    })
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, userIds),
        eq(accounts.type, "depository"),
        eq(accounts.isActive, true),
      ),
    );

  let total = 0;
  for (const row of rows) {
    total += Number.parseFloat(row.balance ?? row.current ?? "0");
  }
  return total;
}

async function averageMonthlyIncome(
  userIds: string[],
  lookbackMonths: number,
): Promise<number> {
  const db = getDb();
  const { accountIds } = await resolveActiveAccountScope(userIds);
  if (accountIds.length === 0) return 0;

  const since = monthsAgo(lookbackMonths);
  const txScope = drizzleActiveTransactionWhere(userIds, accountIds);
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(abs(${transactions.amount}::numeric)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "income"),
        eq(transactions.isTransfer, false),
        gte(transactions.date, since),
      ),
    );

  const total = Number.parseFloat(row?.total ?? "0");
  return total / Math.max(lookbackMonths, 1);
}

async function categorySpendShares(
  userIds: string[],
  lookbackMonths: number,
): Promise<Array<{ name: string; share: number }>> {
  const db = getDb();
  const { accountIds } = await resolveActiveAccountScope(userIds);
  if (accountIds.length === 0) return [];

  const since = monthsAgo(lookbackMonths);
  const txScope = drizzleActiveTransactionWhere(userIds, accountIds);
  const rows = await db
    .select({
      name: transactions.category,
      total: sql<string>`coalesce(sum(abs(${transactions.amount}::numeric)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        txScope,
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        gte(transactions.date, since),
      ),
    )
    .groupBy(transactions.category)
    .orderBy(sql`sum(abs(${transactions.amount}::numeric)) desc`);

  const grandTotal = rows.reduce(
    (sum, row) => sum + Number.parseFloat(row.total ?? "0"),
    0,
  );
  if (grandTotal <= 0) return [];

  return rows
    .map((row) => ({
      name: row.name,
      share: roundDecimal(
        (Number.parseFloat(row.total ?? "0") / grandTotal) * 100,
      ),
    }))
    .filter((row) => row.share >= 1)
    .slice(0, 9);
}

interface ResilienceScenarioTemplate {
  name: string;
  emoji: string;
  shockType: "one_time" | "recurring";
  recommendedMonths: number;
  detail: string;
  shockAmount: (monthlyBurn: number) => number;
}

const RESILIENCE_SCENARIO_TEMPLATES: ResilienceScenarioTemplate[] = [
  {
    name: "Job loss",
    emoji: "💼",
    shockType: "recurring",
    recommendedMonths: 6,
    detail: "No income; covered by liquid savings.",
    shockAmount: (monthlyBurn) => Math.max(monthlyBurn, 1),
  },
  {
    name: "Major car repair",
    emoji: "🔧",
    shockType: "one_time",
    recommendedMonths: 1,
    detail: "Transmission or engine repair.",
    shockAmount: (monthlyBurn) => Math.max(3200, monthlyBurn * 0.75),
  },
  {
    name: "Medical emergency",
    emoji: "🏥",
    shockType: "one_time",
    recommendedMonths: 2,
    detail: "Out-of-pocket max after insurance.",
    shockAmount: (monthlyBurn) => Math.max(5000, monthlyBurn * 2),
  },
  {
    name: "Rate hike on debt",
    emoji: "📈",
    shockType: "recurring",
    recommendedMonths: 3,
    detail: "Variable APR rises on balances.",
    shockAmount: (monthlyBurn) => Math.max(180, monthlyBurn * 0.05),
  },
  {
    name: "Rent increase",
    emoji: "🏠",
    shockType: "recurring",
    recommendedMonths: 3,
    detail: "Lease renewal bump.",
    shockAmount: (monthlyBurn) => Math.max(250, monthlyBurn * 0.08),
  },
];

/** Recompute protect tables from linked accounts and transactions. */
export async function refreshProtectProfiles(userId: string): Promise<boolean> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) return false;

  const monthlyBurn = await averageMonthlyCashSpending(ctx.userIds, 3);
  const monthlyIncome = await averageMonthlyIncome(ctx.userIds, LOOKBACK_MONTHS);
  const categoryShares = await categorySpendShares(ctx.userIds, LOOKBACK_MONTHS);

  if (monthlyBurn <= 0 && monthlyIncome <= 0 && categoryShares.length === 0) {
    return false;
  }

  const db = getDb();
  const liquidCash = await sumDepositoryCash(ctx.userIds);
  const burn = Math.max(monthlyBurn, 1);

  await db
    .insert(resilienceProfiles)
    .values({
      userId,
      liquidCash: formatMoneyAmount(liquidCash),
      monthlyBurn: formatMoneyAmount(burn),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: resilienceProfiles.userId,
      set: {
        liquidCash: formatMoneyAmount(liquidCash),
        monthlyBurn: formatMoneyAmount(burn),
        updatedAt: new Date(),
      },
    });

  await db
    .delete(resilienceScenarios)
    .where(eq(resilienceScenarios.userId, userId));

  await db.insert(resilienceScenarios).values(
    RESILIENCE_SCENARIO_TEMPLATES.map((template, index) => ({
      userId,
      name: template.name,
      emoji: template.emoji,
      shockAmount: formatMoneyAmount(template.shockAmount(burn)),
      shockType: template.shockType,
      recommendedMonths: String(template.recommendedMonths),
      detail: template.detail,
      sortOrder: index,
    })),
  );

  const inflationRows = categoryShares.map((row) => {
    const meta = inflationForCategory(row.name);
    return {
      userId,
      name: row.name,
      share: String(row.share),
      inflationRate: String(meta.rate),
      severity: meta.severity,
      sortOrder: 0,
    };
  });

  for (let i = 0; i < inflationRows.length; i += 1) {
    inflationRows[i]!.sortOrder = i;
  }

  const personalRate =
    inflationRows.length > 0
      ? roundDecimal(
          inflationRows.reduce(
            (sum, row) =>
              sum +
              (Number.parseFloat(row.share) / 100) *
                Number.parseFloat(row.inflationRate),
            0,
          ),
        )
      : NATIONAL_CPI;

  const annualSalary = Math.max(monthlyIncome, burn) * 12;
  const nominalSavingsRate =
    monthlyIncome > 0
      ? roundDecimal(((monthlyIncome - burn) / monthlyIncome) * 100)
      : 0;
  const powerLoss = roundDecimal((annualSalary * personalRate) / 100);

  await db
    .insert(inflationProfiles)
    .values({
      userId,
      personalRate: String(personalRate),
      nationalCpi: String(NATIONAL_CPI),
      salary: formatMoneyAmount(annualSalary),
      raisePercent: String(DEFAULT_RAISE_PERCENT),
      nominalSavingsRate: String(nominalSavingsRate),
      powerLoss: formatMoneyAmount(powerLoss),
      baseDate: monthsAgo(LOOKBACK_MONTHS),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: inflationProfiles.userId,
      set: {
        personalRate: String(personalRate),
        nationalCpi: String(NATIONAL_CPI),
        salary: formatMoneyAmount(annualSalary),
        raisePercent: String(DEFAULT_RAISE_PERCENT),
        nominalSavingsRate: String(nominalSavingsRate),
        powerLoss: formatMoneyAmount(powerLoss),
        baseDate: monthsAgo(LOOKBACK_MONTHS),
        updatedAt: new Date(),
      },
    });

  await db
    .delete(inflationCategories)
    .where(eq(inflationCategories.userId, userId));

  if (inflationRows.length > 0) {
    await db.insert(inflationCategories).values(inflationRows);
  }

  return true;
}
