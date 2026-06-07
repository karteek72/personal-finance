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
import {
  clampDbMoney,
  clampDbPercent,
  formatDbMoney,
  formatDbPercent,
  roundDecimal,
} from "../lib/money.js";
import { computeSavingsRate } from "./metrics/savings-rate.js";
import {
  computePersonalCpi,
  inflationRateFromPrices,
  NATIONAL_CPI_EXTERNAL,
} from "./personal-cpi.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { averageMonthlyCashSpending } from "./investment-analytics.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

const DEFAULT_RAISE_PERCENT = 3.0;
const LOOKBACK_MONTHS = 12;

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function severityForRate(rate: number): "high" | "medium" | "low" {
  if (rate >= 4) return "high";
  if (rate >= 2.5) return "medium";
  return "low";
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

export async function averageMonthlyIncome(
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
    .filter((row) => row.share >= 1);
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
      liquidCash: formatDbMoney(liquidCash, 14),
      monthlyBurn: formatDbMoney(burn, 12),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: resilienceProfiles.userId,
      set: {
        liquidCash: formatDbMoney(liquidCash, 14),
        monthlyBurn: formatDbMoney(burn, 12),
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
      shockAmount: formatDbMoney(template.shockAmount(burn), 12),
      shockType: template.shockType,
      recommendedMonths: String(template.recommendedMonths),
      detail: template.detail,
      sortOrder: index,
    })),
  );

  const personalCpi = await computePersonalCpi(ctx.userIds);

  const inflationRows = categoryShares.map((row) => {
    const cpiItem = personalCpi.basket.find((b) => b.category === row.name);
    const measured =
      cpiItem != null
        ? inflationRateFromPrices(cpiItem.priceNow, cpiItem.priceBase)
        : null;
    const rate = clampDbPercent(measured ?? personalCpi.personalRate);
    return {
      userId,
      name: row.name,
      share: formatDbPercent(row.share),
      inflationRate: formatDbPercent(rate),
      severity: severityForRate(rate),
      sortOrder: 0,
    };
  });

  for (let i = 0; i < inflationRows.length; i += 1) {
    inflationRows[i]!.sortOrder = i;
  }

  const personalRate = clampDbPercent(
    personalCpi.personalRate !== 0
      ? personalCpi.personalRate
      : inflationRows.length > 0
        ? inflationRows.reduce(
            (sum, row) =>
              sum +
              (Number.parseFloat(row.share) / 100) *
                Number.parseFloat(row.inflationRate),
            0,
          )
        : 0,
  );

  const annualSalary = Math.max(monthlyIncome, burn) * 12;
  const nominalSavingsPercent = clampDbPercent(
    computeSavingsRate({
      income: monthlyIncome,
      expense: burn,
    }) * 100,
  );
  const powerLoss = clampDbMoney((annualSalary * personalRate) / 100, 14);

  await db
    .insert(inflationProfiles)
    .values({
      userId,
      personalRate: formatDbPercent(personalRate),
      nationalCpi: formatDbPercent(NATIONAL_CPI_EXTERNAL.rate),
      salary: formatDbMoney(annualSalary, 14),
      raisePercent: formatDbPercent(DEFAULT_RAISE_PERCENT),
      nominalSavingsRate: formatDbPercent(nominalSavingsPercent),
      powerLoss: formatDbMoney(powerLoss, 14),
      baseDate: monthsAgo(LOOKBACK_MONTHS),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: inflationProfiles.userId,
      set: {
        personalRate: formatDbPercent(personalRate),
        nationalCpi: formatDbPercent(NATIONAL_CPI_EXTERNAL.rate),
        salary: formatDbMoney(annualSalary, 14),
        raisePercent: formatDbPercent(DEFAULT_RAISE_PERCENT),
        nominalSavingsRate: formatDbPercent(nominalSavingsPercent),
        powerLoss: formatDbMoney(powerLoss, 14),
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
