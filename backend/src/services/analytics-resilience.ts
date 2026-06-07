import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  creditCardLiabilities,
  dimMerchant,
  fireProfiles,
  holdings,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { DISCRETIONARY_CATEGORIES } from "./analytics-categories.js";
import { resolveHouseholdContext } from "./household-access.js";
import {
  computeEmergencyMonths,
  trailingEssentialOutflow,
} from "./metrics/index.js";
import { averageMonthlyIncome } from "./protect-analytics.js";
import {
  buildResilienceComposite,
  type ResilienceComposite,
  type ResilienceSubScore,
} from "./resilience-scoring.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";
import { emergencyFundTargetMonths } from "./investment-analytics.js";

export interface ResilienceAnalyticsResponse {
  score: number;
  band: string;
  confidence: number;
  liquidCash: string;
  monthlyBurn: string;
  runwayMonths: number;
  householdSize: number | null;
  emergencyFundTargetMonths: number;
  subScores: ResilienceSubScore[];
  scenarios: Array<{
    id: string;
    name: string;
    emoji: string | null;
    shockType: string;
    recommendedMonths: number;
    detail: string | null;
    /** User-derived baseline only — shock amount computed from profile, not hardcoded. */
    baselineMonthlyImpact: string;
    monthsCovered: number;
  }>;
  isLive: boolean;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
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

async function monthlyIncomeSeries(
  userIds: string[],
  accountIds: string[],
  months: number,
): Promise<number[]> {
  const db = getDb();
  const since = monthsAgo(months);
  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(abs(${transactions.amount}::numeric)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "income"),
        eq(transactions.isTransfer, false),
        gte(transactions.date, since),
      ),
    )
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

  return rows.map((r) => Number.parseFloat(r.total ?? "0"));
}

async function countIncomeSources(userIds: string[], accountIds: string[]): Promise<number> {
  const db = getDb();
  const since = monthsAgo(12);
  const rows = await db
    .select({
      source: sql<string>`coalesce(${dimMerchant.canonicalKey}, lower(trim(coalesce(${transactions.merchantName}, ${transactions.name}))))`,
    })
    .from(transactions)
    .leftJoin(dimMerchant, eq(transactions.merchantId, dimMerchant.id))
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "income"),
        eq(transactions.isTransfer, false),
        gte(transactions.date, since),
      ),
    )
    .groupBy(
      sql`coalesce(${dimMerchant.canonicalKey}, lower(trim(coalesce(${transactions.merchantName}, ${transactions.name}))))`,
    );

  return rows.filter((r) => r.source && r.source.length > 0).length;
}

async function outflowSplit(
  userIds: string[],
  accountIds: string[],
): Promise<{ discretionary: number; total: number }> {
  const db = getDb();
  const since = monthsAgo(3);
  const discretionaryList = [...DISCRETIONARY_CATEGORIES];
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
        gte(transactions.date, since),
      ),
    )
    .groupBy(transactions.category);

  let discretionary = 0;
  let total = 0;
  for (const row of rows) {
    const amt = Number.parseFloat(row.total ?? "0");
    total += amt;
    if (discretionaryList.includes(row.category)) {
      discretionary += amt;
    }
  }
  return { discretionary, total };
}

async function monthlyDebtPayments(userIds: string[]): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      minimum: creditCardLiabilities.minimumPaymentAmount,
      balance: accounts.balanceCurrent,
    })
    .from(creditCardLiabilities)
    .innerJoin(accounts, eq(creditCardLiabilities.accountId, accounts.id))
    .where(
      and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)),
    );

  let total = 0;
  for (const row of rows) {
    const min = Number.parseFloat(row.minimum ?? "0");
    if (min > 0) {
      total += min;
      continue;
    }
    const balance = Math.abs(Number.parseFloat(row.balance ?? "0"));
    total += Math.max(balance * 0.02, 25);
  }
  return total;
}

async function investmentLiquidityTotals(userIds: string[]): Promise<{
  liquidInvest: number;
  totalInvest: number;
}> {
  const db = getDb();
  const investAccounts = await db
    .select({
      id: accounts.id,
      balance: accounts.balanceCurrent,
    })
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, userIds),
        eq(accounts.isActive, true),
        sql`${accounts.type} in ('investment', 'brokerage')`,
      ),
    );

  if (investAccounts.length === 0) {
    return { liquidInvest: 0, totalInvest: 0 };
  }

  const accountIds = investAccounts.map((a) => a.id);
  const holdingRows = await db
    .select({
      accountId: holdings.accountId,
      value: holdings.institutionValue,
      quantity: holdings.quantity,
      price: holdings.costBasis,
    })
    .from(holdings)
    .where(inArray(holdings.accountId, accountIds));

  const holdingsByAccount = new Map<string, number>();
  for (const row of holdingRows) {
    const val = Number.parseFloat(row.value ?? "0");
    const fallback =
      Number.parseFloat(row.quantity ?? "0") *
      Number.parseFloat(row.price ?? "0");
    const mv = val > 0 ? val : fallback;
    holdingsByAccount.set(
      row.accountId,
      (holdingsByAccount.get(row.accountId) ?? 0) + mv,
    );
  }

  let totalInvest = 0;
  let liquidInvest = 0;
  for (const account of investAccounts) {
    const balance = Number.parseFloat(account.balance ?? "0");
    const invested = holdingsByAccount.get(account.id) ?? 0;
    totalInvest += Math.max(balance, invested);
    liquidInvest += Math.max(0, balance - invested);
  }

  return { liquidInvest, totalInvest };
}

export async function getResilienceAnalytics(
  userId: string,
): Promise<ResilienceAnalyticsResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  if (!hasActiveAccounts) return null;

  const db = getDb();
  const [profileRow] = await db
    .select({ householdSize: fireProfiles.householdSize })
    .from(fireProfiles)
    .where(eq(fireProfiles.userId, userId))
    .limit(1);
  const householdSize = profileRow?.householdSize ?? null;
  const fundTargetMonths = emergencyFundTargetMonths(householdSize);

  const asOf = new Date().toISOString().slice(0, 10);
  const liquidCash = await sumDepositoryCash(ctx.userIds);
  const trailing = await trailingEssentialOutflow(ctx.userIds, accountIds, asOf, 3);
  const burn = trailing.total / Math.max(trailing.months, 1);
  const emergencyMonths = computeEmergencyMonths({
    liquidReserves: liquidCash,
    essentialBurnRate: burn,
  });
  const monthlyIncomes = await monthlyIncomeSeries(ctx.userIds, accountIds, 12);
  const incomeSourceCount = await countIncomeSources(ctx.userIds, accountIds);
  const outflow = await outflowSplit(ctx.userIds, accountIds);
  const monthlyIncome = await averageMonthlyIncome(ctx.userIds, 12);
  const debtPayments = await monthlyDebtPayments(ctx.userIds);
  const dti = monthlyIncome > 0 ? debtPayments / monthlyIncome : 0;
  const { liquidInvest, totalInvest } = await investmentLiquidityTotals(
    ctx.userIds,
  );

  const composite: ResilienceComposite = buildResilienceComposite({
    emergencyMonths,
    monthlyIncomes,
    incomeSourceCount,
    discretionaryOutflow: outflow.discretionary,
    totalOutflow: outflow.total,
    dti,
    liquidInvest,
    totalInvest,
    asOf,
  });

  const runwayMonths =
    burn > 0 ? roundDecimal(liquidCash / burn) : 0;

  const scenarios = [
    {
      id: "job-loss",
      name: "Job loss",
      emoji: "💼",
      shockType: "recurring",
      recommendedMonths: 6,
      detail: "No income; covered by liquid savings.",
      baselineMonthlyImpact: formatMoneyAmount(burn),
    },
    {
      id: "medical-emergency",
      name: "Medical emergency",
      emoji: "🏥",
      shockType: "one_time",
      recommendedMonths: 2,
      detail: "Out-of-pocket medical costs sized to your monthly burn.",
      baselineMonthlyImpact: formatMoneyAmount(Math.max(burn * 2, 1)),
    },
  ].map((s) => {
    const impact = Number.parseFloat(s.baselineMonthlyImpact);
    const monthsCovered =
      s.shockType === "recurring"
        ? roundDecimal(liquidCash / (burn + impact))
        : roundDecimal(liquidCash / impact);
    return { ...s, monthsCovered };
  });

  return {
    score: composite.score,
    band: composite.band,
    confidence: composite.confidence,
    liquidCash: formatMoneyAmount(liquidCash),
    monthlyBurn: formatMoneyAmount(burn),
    runwayMonths,
    householdSize,
    emergencyFundTargetMonths: fundTargetMonths,
    subScores: composite.subScores,
    scenarios,
    isLive: true,
  };
}
