import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import {
  accounts,
  recurringSeries,
  resilienceProfiles,
  savingsGoals,
} from "../../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../../lib/money.js";
import {
  averageMonthlyCashSpending,
  averageMonthlyInvestment,
} from "../investment-analytics.js";
import { resolveHouseholdContext } from "../household-access.js";
import { averageMonthlyIncome } from "../protect-analytics.js";
import type { GoalKind } from "./planning-crud.js";

export type SuggestionConfidence = "low" | "medium" | "high";

export interface SuggestedGoalItem {
  name: string;
  emoji: string | null;
  color: string | null;
  target: string;
  current: string;
  deadline: string | null;
  kind: GoalKind;
  status: "active";
  source: "suggested";
  rationale: string;
  confidence: SuggestionConfidence;
  monthlySetAside?: string;
  accountId?: string | null;
}

interface ExistingGoalKey {
  kind: string;
  name: string;
  accountId: string | null;
}

function roundSurplusGoal(amount: number): number {
  if (amount < 100) return Math.round(amount / 25) * 25;
  if (amount < 500) return Math.round(amount / 50) * 50;
  return Math.round(amount / 100) * 100;
}

function monthsUntil(dateIso: string | null): number {
  if (!dateIso) return 12;
  const target = Date.parse(dateIso);
  if (Number.isNaN(target)) return 12;
  const now = Date.now();
  const diffMs = target - now;
  if (diffMs <= 0) return 1;
  return Math.max(1, Math.ceil(diffMs / (30 * 24 * 60 * 60 * 1000)));
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

function isBlocked(
  existing: ExistingGoalKey[],
  kind: string,
  name: string,
  accountId?: string | null,
): boolean {
  const normalizedName = name.trim().toLowerCase();
  return existing.some((goal) => {
    if (goal.kind !== kind) return false;
    if (accountId && goal.accountId && goal.accountId === accountId) return true;
    return goal.name.trim().toLowerCase() === normalizedName;
  });
}

export async function buildSuggestedGoals(
  userId: string,
): Promise<SuggestedGoalItem[]> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const goalRows = await db
    .select({
      kind: savingsGoals.kind,
      name: savingsGoals.name,
      accountId: savingsGoals.accountId,
    })
    .from(savingsGoals)
    .where(inArray(savingsGoals.userId, ctx.userIds));

  const existing: ExistingGoalKey[] = goalRows.map((row) => ({
    kind: row.kind,
    name: row.name,
    accountId: row.accountId,
  }));

  const suggestions: SuggestedGoalItem[] = [];

  const [profile] = await db
    .select({ monthlyBurn: resilienceProfiles.monthlyBurn })
    .from(resilienceProfiles)
    .where(inArray(resilienceProfiles.userId, ctx.userIds))
    .limit(1);

  const monthlyBurn = Number.parseFloat(
    profile?.monthlyBurn ??
      formatMoneyAmount(await averageMonthlyCashSpending(ctx.userIds, 3)),
  );
  const liquidCash = await sumDepositoryCash(ctx.userIds);

  if (monthlyBurn > 0 && !isBlocked(existing, "emergency", "Emergency fund")) {
    const targetMonths = 6;
    const target = roundDecimal(monthlyBurn * targetMonths);
    suggestions.push({
      name: "Emergency fund",
      emoji: "🛡️",
      color: "#22C55E",
      target: formatMoneyAmount(target),
      current: formatMoneyAmount(liquidCash),
      deadline: null,
      kind: "emergency",
      status: "active",
      source: "suggested",
      rationale: `${targetMonths}× monthly burn (${formatMoneyAmount(monthlyBurn)}/mo) — ${formatMoneyAmount(liquidCash)} in liquid cash today`,
      confidence: profile ? "high" : "medium",
    });
  }

  const debtAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      mask: accounts.mask,
      balance: accounts.balanceCurrent,
      subtype: accounts.subtype,
    })
    .from(accounts)
    .where(
      and(
        inArray(accounts.userId, ctx.userIds),
        eq(accounts.isActive, true),
        eq(accounts.type, "credit"),
      ),
    );

  for (const account of debtAccounts) {
    const balance = Number.parseFloat(account.balance ?? "0");
    if (balance <= 0) continue;

    const goalName = `Pay off ${account.name}${account.mask ? ` ••${account.mask}` : ""}`;
    if (isBlocked(existing, "debt", goalName, account.id)) continue;

    suggestions.push({
      name: goalName,
      emoji: "💳",
      color: "#EF4444",
      target: formatMoneyAmount(balance),
      current: "0.00",
      deadline: null,
      kind: "debt",
      status: "active",
      source: "suggested",
      rationale: `Outstanding balance on ${account.name}; progress tracking starts at $0 until balance snapshots ship`,
      confidence: "low",
      accountId: account.id,
    });
  }

  const annualBills = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        inArray(recurringSeries.userId, ctx.userIds),
        eq(recurringSeries.cadence, "annual"),
        eq(recurringSeries.status, "active"),
        inArray(recurringSeries.kind, ["bill", "subscription"]),
      ),
    );

  for (const bill of annualBills) {
    const amount = Number.parseFloat(bill.amount);
    if (amount <= 0) continue;

    const goalName = `${bill.merchantName} sinking fund`;
    if (isBlocked(existing, "sinking", goalName)) continue;

    const months = monthsUntil(bill.nextChargeDate);
    const monthlySetAside = roundDecimal(amount / months);
    suggestions.push({
      name: goalName,
      emoji: "🪣",
      color: "#6366F1",
      target: formatMoneyAmount(amount),
      current: "0.00",
      deadline: bill.nextChargeDate,
      kind: "sinking",
      status: "active",
      source: "suggested",
      rationale: `Annual ${bill.merchantName} bill (${formatMoneyAmount(amount)}); set aside ${formatMoneyAmount(monthlySetAside)}/mo until due`,
      confidence: bill.nextChargeDate ? "high" : "medium",
      monthlySetAside: formatMoneyAmount(monthlySetAside),
    });
  }

  const monthlyIncome = await averageMonthlyIncome(ctx.userIds, 3);
  const monthlySpend = await averageMonthlyCashSpending(ctx.userIds, 3);
  const monthlyInvest = await averageMonthlyInvestment(ctx.userIds, 3);
  const surplus = monthlyIncome - monthlySpend - monthlyInvest;

  if (surplus > 50 && !isBlocked(existing, "surplus", "Monthly surplus saver")) {
    const target = roundSurplusGoal(surplus);
    suggestions.push({
      name: "Monthly surplus saver",
      emoji: "💰",
      color: "#14B8A6",
      target: formatMoneyAmount(target),
      current: "0.00",
      deadline: null,
      kind: "surplus",
      status: "active",
      source: "suggested",
      rationale: `Avg surplus ${formatMoneyAmount(surplus)}/mo (income ${formatMoneyAmount(monthlyIncome)} − spend ${formatMoneyAmount(monthlySpend)} − invest ${formatMoneyAmount(monthlyInvest)})`,
      confidence: monthlyIncome > 0 ? "medium" : "low",
      monthlySetAside: formatMoneyAmount(target),
    });
  }

  return suggestions;
}
