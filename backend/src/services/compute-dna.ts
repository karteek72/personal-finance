import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { computeSavingsRate } from "./metrics/savings-rate.js";
import { monthCashflowTotals } from "./metrics/transaction-aggregates.js";
import type { DnaResponse } from "./insights-store.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

const DNA_AXES = [
  "Dining",
  "Travel",
  "Shopping",
  "Groceries",
  "Subscriptions",
  "Transport",
  "Wellness",
  "Savings",
] as const;

type DnaAxis = (typeof DNA_AXES)[number];

/** Typical household spend share (%) used for peer comparison — heuristic baseline. */
const PEER_SPEND_SHARE_PCT: Record<Exclude<DnaAxis, "Savings">, number> = {
  Dining: 12,
  Travel: 8,
  Shopping: 15,
  Groceries: 14,
  Subscriptions: 6,
  Transport: 12,
  Wellness: 8,
};

/** Radar chart peer baselines (0–100), aligned with mock cohort medians. */
const PEER_RADAR_SCORE: Record<DnaAxis, number> = {
  Dining: 48,
  Travel: 39,
  Shopping: 58,
  Groceries: 61,
  Subscriptions: 41,
  Transport: 55,
  Wellness: 44,
  Savings: 50,
};

const PEER_SAVINGS_RATE_PCT = 15;

const AXIS_CATEGORIES: Record<Exclude<DnaAxis, "Savings">, readonly string[]> = {
  Dining: ["Dining & Restaurants"],
  Travel: ["Travel"],
  Shopping: ["Shopping & Retail", "Entertainment", "Gifts & Donations"],
  Groceries: ["Food & Groceries"],
  Subscriptions: ["Subscriptions & Software"],
  Transport: ["Transportation"],
  Wellness: ["Health & Medical", "Personal Care"],
};

const ARCHETYPE_BY_AXIS: Record<DnaAxis, string> = {
  Dining: "The Experience Seeker",
  Travel: "The Explorer",
  Shopping: "The Curator",
  Groceries: "The Home Chef",
  Subscriptions: "The Optimizer",
  Transport: "The Road Warrior",
  Wellness: "The Wellbeing Investor",
  Savings: "The Builder",
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function trailingMonths(endDate: string, count: number): string[] {
  const [y, m] = endDate.split("-").map(Number);
  const cursor = new Date(Date.UTC(y!, m! - 1, 1));
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    months.unshift(
      `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return months;
}

export function spendAxisScore(
  userSharePct: number,
  peerSharePct: number,
  peerRadar: number,
): number {
  if (peerSharePct <= 0) return 50;
  const ratio = userSharePct / peerSharePct;
  return clampScore(peerRadar * ratio);
}

export function savingsAxisScore(savingsRatePct: number): number {
  if (PEER_SAVINGS_RATE_PCT <= 0) return 50;
  return clampScore((savingsRatePct / PEER_SAVINGS_RATE_PCT) * PEER_RADAR_SCORE.Savings);
}

export function pickArchetype(
  axes: Array<{ label: string; you: number; peers: number }>,
): { archetype: string; leadAxis: DnaAxis } {
  const spendAxes = axes.filter((a) => a.label !== "Savings");
  const ranked = [...spendAxes].sort(
    (a, b) => b.you - b.peers - (a.you - a.peers),
  );
  const lead = (ranked[0]?.label ?? "Dining") as DnaAxis;
  return {
    archetype: ARCHETYPE_BY_AXIS[lead] ?? "The Spender",
    leadAxis: lead,
  };
}

export function buildDnaNarrative(
  archetype: string,
  leadAxis: DnaAxis,
  savingsYou: number,
  savingsPeers: number,
): string {
  const lead = leadAxis.toLowerCase();
  const savesMore = savingsYou >= savingsPeers + 8;
  const savesLess = savingsYou <= savingsPeers - 8;

  if (archetype === "The Builder") {
    return savesMore
      ? "You prioritize saving and investing ahead of discretionary spend."
      : "Saving is your standout habit relative to other spending dimensions.";
  }
  if (savesMore) {
    return `You lean into ${lead} while still saving more than typical households.`;
  }
  if (savesLess) {
    return `Your spending tilts toward ${lead}; building savings could be your next lever.`;
  }
  return `Your spending fingerprint is most distinctive in ${lead}, near typical savings habits.`;
}

export async function computeDnaFromTransactions(
  userIds: string[],
): Promise<DnaResponse | null> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) {
    return null;
  }

  const db = getDb();
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = (() => {
    const d = new Date(`${endDate}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 6);
    return d.toISOString().slice(0, 10);
  })();

  const baseWhere = drizzleActiveTransactionWhere(userIds, accountIds);

  const categoryRows = await db
    .select({
      category: transactions.category,
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
        gte(transactions.date, startDate),
      ),
    )
    .groupBy(transactions.category);

  const spendByCategory = new Map<string, number>();
  let totalExpense = 0;
  for (const row of categoryRows) {
    const amount = Number.parseFloat(row.total ?? "0");
    if (amount <= 0) continue;
    spendByCategory.set(row.category, amount);
    totalExpense += amount;
  }

  if (totalExpense <= 0) {
    return null;
  }

  const axisSpend = new Map<Exclude<DnaAxis, "Savings">, number>();
  for (const axis of DNA_AXES) {
    if (axis === "Savings") continue;
    const categories = AXIS_CATEGORIES[axis];
    const sum = categories.reduce(
      (acc, category) => acc + (spendByCategory.get(category) ?? 0),
      0,
    );
    axisSpend.set(axis, sum);
  }

  const months = trailingMonths(endDate.slice(0, 7), 3);
  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const month of months) {
    const totals = await monthCashflowTotals(userIds, accountIds, month);
    incomeTotal += totals.income;
    expenseTotal += totals.expense;
  }
  const savingsRatePct = computeSavingsRate({
    income: incomeTotal,
    expense: expenseTotal,
  }) * 100;

  const axes = DNA_AXES.map((label) => {
    if (label === "Savings") {
      const you = savingsAxisScore(savingsRatePct);
      return {
        label,
        you,
        peers: PEER_RADAR_SCORE.Savings,
      };
    }
    const spend = axisSpend.get(label) ?? 0;
    const userSharePct = (spend / totalExpense) * 100;
    const peerSharePct = PEER_SPEND_SHARE_PCT[label];
    const you = spendAxisScore(
      userSharePct,
      peerSharePct,
      PEER_RADAR_SCORE[label],
    );
    return {
      label,
      you,
      peers: PEER_RADAR_SCORE[label],
    };
  });

  const { archetype, leadAxis } = pickArchetype(axes);
  const savingsAxis = axes.find((a) => a.label === "Savings");

  return {
    archetype,
    narrative: buildDnaNarrative(
      archetype,
      leadAxis,
      savingsAxis?.you ?? 50,
      savingsAxis?.peers ?? PEER_RADAR_SCORE.Savings,
    ),
    peerRarity: null,
    axes,
    isLive: true,
  };
}
