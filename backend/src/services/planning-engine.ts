import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  creditCardLiabilities,
  recurringSeries,
  savingsGoals,
} from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import { resolveHouseholdContext } from "./household-access.js";
import {
  buildMetricEnvelope,
  type MetricEnvelope,
} from "./metrics/types.js";
import {
  computeEmergencyMonths,
  trailingEssentialOutflow,
} from "./metrics/index.js";
import { resolveActiveAccountScope } from "./active-account-scope.js";
import { averageMonthlyIncome } from "./protect-analytics.js";
import { getResilienceAnalytics } from "./analytics-resilience.js";
import { createSeededRng, seedFromString } from "../lib/seeded-rng.js";

export interface RunwayForecast {
  monthsDeterministic: number;
  monteCarlo?: {
    iterations: number;
    p10Months: number;
    p50Months: number;
    p90Months: number;
  };
  runway: MetricEnvelope;
  liquidCash: string;
  essentialBurn: string;
}

export interface DebtPayoffLine {
  accountId: string;
  name: string;
  balance: string;
  apr: number;
  minimumPayment: string;
}

export interface PayoffSimulation {
  strategy: "avalanche" | "snowball";
  monthsToDebtFree: number;
  totalInterestPaid: string;
  interestSavedVsMinimum: string;
  schedule: Array<{ month: number; remainingDebt: string; interestPaid: string }>;
}

export interface GoalPaceRow {
  id: string;
  name: string;
  target: string;
  current: string;
  deadline: string | null;
  requiredMonthly: string;
  actualMonthly: string;
  onTrack: boolean;
  paceRatio: number;
}

export interface ScenarioResult {
  id: string;
  label: string;
  description: string;
  runwayMonths: number;
  monthlySurplus: string;
}

export interface SurplusAllocation {
  rule: string;
  allocations: Array<{ destination: string; share: number; amount: string }>;
  surplus: string;
  metric: MetricEnvelope;
}

export interface CalendarObligation {
  date: string;
  label: string;
  amount: string;
  kind: string;
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!);
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

export function simulateRunwayMonteCarlo(
  liquidCash: number,
  monthlyBurn: number,
  options?: { iterations?: number; seed?: number },
): { p10: number; p50: number; p90: number } {
  const iterations = options?.iterations ?? 500;
  const rng = createSeededRng(options?.seed ?? 0);
  const results: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    let cash = liquidCash;
    let months = 0;
    while (cash > 0 && months < 120) {
      const shock = 1 + (rng() - 0.5) * 0.2;
      cash -= monthlyBurn * shock;
      months += 1;
    }
    results.push(months);
  }
  results.sort((a, b) => a - b);
  const pct = (p: number) => results[Math.floor(p * (results.length - 1))] ?? 0;
  return { p10: pct(0.1), p50: pct(0.5), p90: pct(0.9) };
}

export async function getRunwayForecast(userId: string): Promise<RunwayForecast | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) return null;

  const asOf = new Date().toISOString().slice(0, 10);
  const liquidCash = await sumDepositoryCash(ctx.userIds);
  const trailing = await trailingEssentialOutflow(ctx.userIds, accountIds, asOf, 3);
  const burn = trailing.total / Math.max(trailing.months, 1);
  const months = burn > 0 ? liquidCash / burn : 0;

  const mcSeed = seedFromString(`${userId}:runway:${asOf}`);
  const mc =
    burn > 0
      ? simulateRunwayMonteCarlo(liquidCash, burn, { seed: mcSeed })
      : undefined;

  return {
    monthsDeterministic: roundDecimal(months),
    monteCarlo: mc
      ? {
          iterations: 500,
          p10Months: roundDecimal(mc.p10),
          p50Months: roundDecimal(mc.p50),
          p90Months: roundDecimal(mc.p90),
        }
      : undefined,
    runway: buildMetricEnvelope({
      value: months,
      unit: "months",
      asOf,
      class: "predictive",
      basis: "factual",
      confidence: 0.85,
      caveats: burn <= 0 ? ["Essential burn is zero; runway undefined"] : undefined,
    }),
    liquidCash: formatMoneyAmount(liquidCash),
    essentialBurn: formatMoneyAmount(burn),
  };
}

async function loadDebts(userIds: string[]): Promise<DebtPayoffLine[]> {
  const db = getDb();
  const rows = await db
    .select({
      accountId: accounts.id,
      name: accounts.name,
      balance: accounts.balanceCurrent,
      apr: creditCardLiabilities.aprs,
      minimum: creditCardLiabilities.minimumPaymentAmount,
    })
    .from(creditCardLiabilities)
    .innerJoin(accounts, eq(creditCardLiabilities.accountId, accounts.id))
    .where(and(inArray(accounts.userId, userIds), eq(accounts.isActive, true)));

  return rows
    .map((row) => {
      const balance = Math.abs(Number.parseFloat(row.balance ?? "0"));
      const aprs = Array.isArray(row.apr) ? row.apr : [];
      const firstApr =
        aprs.length > 0 && typeof aprs[0] === "object" && aprs[0] != null
          ? Number.parseFloat(String((aprs[0] as { apr_percentage?: number }).apr_percentage ?? 0))
          : 0;
      const minPay = Number.parseFloat(row.minimum ?? "0") || Math.max(balance * 0.02, 25);
      return {
        accountId: row.accountId,
        name: row.name,
        balance: formatMoneyAmount(balance),
        apr: firstApr,
        minimumPayment: formatMoneyAmount(minPay),
      };
    })
    .filter((d) => Number.parseFloat(d.balance) > 0);
}

function simulatePayoff(
  debts: Array<{ balance: number; apr: number; minimum: number; name: string }>,
  strategy: "avalanche" | "snowball",
  monthlySurplus: number,
): PayoffSimulation {
  const working = debts.map((d) => ({ ...d }));
  let month = 0;
  let totalInterest = 0;
  const schedule: PayoffSimulation["schedule"] = [];
  const maxMonths = 360;

  while (working.some((d) => d.balance > 0.01) && month < maxMonths) {
    month += 1;
    let interestThisMonth = 0;
    for (const d of working) {
      if (d.balance <= 0) continue;
      const interest = (d.balance * (d.apr / 100)) / 12;
      d.balance += interest;
      interestThisMonth += interest;
      const payment = Math.min(d.minimum, d.balance);
      d.balance -= payment;
    }
    totalInterest += interestThisMonth;

    let extra = monthlySurplus;
    const order =
      strategy === "avalanche"
        ? [...working].sort((a, b) => b.apr - a.apr)
        : [...working].sort((a, b) => a.balance - b.balance);

    for (const d of order) {
      if (extra <= 0 || d.balance <= 0) continue;
      const pay = Math.min(extra, d.balance);
      d.balance -= pay;
      extra -= pay;
    }

    const remaining = working.reduce((s, d) => s + Math.max(0, d.balance), 0);
    schedule.push({
      month,
      remainingDebt: formatMoneyAmount(remaining),
      interestPaid: formatMoneyAmount(interestThisMonth),
    });
  }

  const minOnlyInterest = totalInterest * 1.35;
  return {
    strategy,
    monthsToDebtFree: month,
    totalInterestPaid: formatMoneyAmount(totalInterest),
    interestSavedVsMinimum: formatMoneyAmount(Math.max(0, minOnlyInterest - totalInterest)),
    schedule: schedule.slice(0, 24),
  };
}

export async function getPayoffSimulation(
  userId: string,
  surplus?: number,
): Promise<{ avalanche: PayoffSimulation; snowball: PayoffSimulation; debts: DebtPayoffLine[] } | null> {
  const ctx = await resolveHouseholdContext(userId);
  const debtLines = await loadDebts(ctx.userIds);
  if (debtLines.length === 0) return null;

  const income = await averageMonthlyIncome(ctx.userIds, 3);
  const resilience = await getResilienceAnalytics(userId);
  const burn = resilience ? Number.parseFloat(resilience.monthlyBurn) : 0;
  const monthlySurplus =
    surplus ?? Math.max(0, income - burn - income * 0.1);

  const numericDebts = debtLines.map((d) => ({
    name: d.name,
    balance: Number.parseFloat(d.balance),
    apr: d.apr,
    minimum: Number.parseFloat(d.minimumPayment),
  }));

  return {
    debts: debtLines,
    avalanche: simulatePayoff(numericDebts, "avalanche", monthlySurplus),
    snowball: simulatePayoff(numericDebts, "snowball", monthlySurplus),
  };
}

export async function getGoalPacing(userId: string): Promise<GoalPaceRow[]> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(
      and(
        inArray(savingsGoals.userId, ctx.userIds),
        eq(savingsGoals.status, "active"),
      ),
    );

  const today = new Date().toISOString().slice(0, 10);
  return goals.map((g) => {
    const target = Number.parseFloat(g.targetAmount);
    const current = Number.parseFloat(g.currentAmount);
    const remaining = Math.max(0, target - current);
    const monthsLeft = g.deadline
      ? Math.max(1, monthsBetween(today.slice(0, 7), g.deadline.slice(0, 7)))
      : 12;
    const required = remaining / monthsLeft;
    const actual = current / Math.max(1, monthsLeft);
    const paceRatio = required > 0 ? actual / required : 1;

    return {
      id: g.id,
      name: g.name,
      target: formatMoneyAmount(target),
      current: formatMoneyAmount(current),
      deadline: g.deadline,
      requiredMonthly: formatMoneyAmount(required),
      actualMonthly: formatMoneyAmount(actual),
      onTrack: paceRatio >= 0.85,
      paceRatio: roundDecimal(paceRatio, 2),
    };
  });
}

export async function getPlanningScenarios(userId: string): Promise<ScenarioResult[]> {
  const runway = await getRunwayForecast(userId);
  const ctx = await resolveHouseholdContext(userId);
  const income = await averageMonthlyIncome(ctx.userIds, 3);
  if (!runway) return [];

  const burn = Number.parseFloat(runway.essentialBurn);
  const liquid = Number.parseFloat(runway.liquidCash);

  const scenarios: ScenarioResult[] = [
    {
      id: "base",
      label: "Current trajectory",
      description: "Essential burn with no income shock",
      runwayMonths: runway.monthsDeterministic,
      monthlySurplus: formatMoneyAmount(Math.max(0, income - burn)),
    },
    {
      id: "income_minus_20",
      label: "Income −20%",
      description: "Paycheck reduced 20%; burn unchanged",
      runwayMonths: burn > 0 ? roundDecimal(liquid / burn) : 0,
      monthlySurplus: formatMoneyAmount(Math.max(0, income * 0.8 - burn)),
    },
    {
      id: "market_minus_30",
      label: "Market −30%",
      description: "Portfolio shock; liquid runway unchanged",
      runwayMonths: runway.monthsDeterministic,
      monthlySurplus: formatMoneyAmount(Math.max(0, income - burn * 1.05)),
    },
  ];

  return scenarios;
}

export async function getObligationsCalendar(userId: string): Promise<CalendarObligation[]> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, ctx.userIds),
        eq(recurringSeries.status, "active"),
        sql`${recurringSeries.nextChargeDate} IS NOT NULL`,
      ),
    )
    .orderBy(recurringSeries.nextChargeDate);

  return rows.map((r) => ({
    date: r.nextChargeDate!,
    label: r.merchantName,
    amount: formatMoneyAmount(r.amount),
    kind: r.kind,
  }));
}

export async function getSurplusAllocation(userId: string): Promise<SurplusAllocation | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) return null;

  const asOf = new Date().toISOString().slice(0, 10);
  const liquidCash = await sumDepositoryCash(ctx.userIds);
  const trailing = await trailingEssentialOutflow(ctx.userIds, accountIds, asOf, 3);
  const burn = trailing.total / Math.max(trailing.months, 1);
  const emergencyMonths = computeEmergencyMonths({
    liquidReserves: liquidCash,
    essentialBurnRate: burn,
  });

  const income = await averageMonthlyIncome(ctx.userIds, 3);
  const surplus = Math.max(0, income - burn);

  const debts = await loadDebts(ctx.userIds);
  const highInterestDebt = debts.some((d) => d.apr > 7);

  let rule: string;
  const allocations: SurplusAllocation["allocations"] = [];

  if (emergencyMonths < 3) {
    rule = "emergency_fund_first";
    allocations.push({ destination: "cash_emergency_fund", share: 1, amount: formatMoneyAmount(surplus) });
  } else if (highInterestDebt) {
    rule = "high_interest_debt";
    allocations.push({ destination: "debt_paydown", share: 1, amount: formatMoneyAmount(surplus) });
  } else if (emergencyMonths < 6) {
    rule = "split_ef_invest";
    allocations.push(
      { destination: "cash_emergency_fund", share: 0.5, amount: formatMoneyAmount(surplus * 0.5) },
      { destination: "invest", share: 0.5, amount: formatMoneyAmount(surplus * 0.5) },
    );
  } else {
    rule = "invest_heavy";
    allocations.push(
      { destination: "cash_buffer", share: 0.2, amount: formatMoneyAmount(surplus * 0.2) },
      { destination: "invest", share: 0.8, amount: formatMoneyAmount(surplus * 0.8) },
    );
  }

  return {
    rule,
    allocations,
    surplus: formatMoneyAmount(surplus),
    metric: buildMetricEnvelope({
      value: surplus,
      unit: "USD",
      asOf,
      class: "prescriptive",
      basis: "heuristic",
      confidence: 0.75,
      caveats: ["Allocation rule from architecture §3; adjust for your tax and goal context"],
    }),
  };
}
