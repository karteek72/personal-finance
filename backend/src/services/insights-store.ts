import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  challenges,
  habitStreaks,
  spendingDna,
  spendingPatterns,
  transactionReasons,
  transactions,
  wellnessScores,
} from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import { resolveHouseholdContext } from "./household-access.js";

export interface WellnessResponse {
  score: number;
  delta: number;
  history: Array<{ month: string; score: number }>;
  dimensions: Array<{
    name: string;
    score: number;
    weight: number;
    description: string;
    trend: string;
  }>;
}

export async function getWellness(userId: string): Promise<WellnessResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(wellnessScores)
    .where(inArray(wellnessScores.userId, ctx.userIds))
    .orderBy(asc(wellnessScores.periodMonth));

  const latest = rows[rows.length - 1];
  const prior = rows[rows.length - 2];
  const dimensions =
    (latest?.dimensions as WellnessResponse["dimensions"] | undefined) ?? [];

  return {
    score: latest?.score ?? 0,
    delta: latest && prior ? latest.score - prior.score : 0,
    history: rows.map((r) => ({ month: r.periodMonth.slice(5), score: r.score })),
    dimensions,
  };
}

export interface DnaResponse {
  archetype: string;
  narrative: string;
  peerRarity: string | null;
  axes: Array<{ label: string; you: number; peers: number }>;
}

export async function getDna(userId: string): Promise<DnaResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const [row] = await db
    .select()
    .from(spendingDna)
    .where(inArray(spendingDna.userId, ctx.userIds))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    archetype: row.archetype,
    narrative: row.narrative,
    peerRarity: row.peerRarity,
    axes: (row.axes as DnaResponse["axes"]) ?? [],
  };
}

export interface PatternsResponse {
  dayOfWeek: Array<{ day: string; value: string }>;
  patterns: Array<{
    label: string;
    value: string;
    description: string;
    severity: string;
  }>;
}

export async function getPatterns(userId: string): Promise<PatternsResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(spendingPatterns)
    .where(inArray(spendingPatterns.userId, ctx.userIds))
    .orderBy(asc(spendingPatterns.sortOrder));

  return {
    dayOfWeek: rows
      .filter((r) => r.kind === "day_of_week")
      .map((r) => ({ day: r.label, value: r.metric ?? "0.00" })),
    patterns: rows
      .filter((r) => r.kind === "pattern")
      .map((r) => ({
        label: r.label,
        value: r.metric ?? "",
        description: r.description ?? "",
        severity: r.severity ?? "neutral",
      })),
  };
}

const REASON_META: Record<
  string,
  { emoji: string; label: string; color: string }
> = {
  need: { emoji: "✅", label: "Need", color: "#22C55E" },
  treat: { emoji: "🍰", label: "Treat", color: "#F97316" },
  social: { emoji: "🥂", label: "Social", color: "#3B82F6" },
  bored: { emoji: "😪", label: "Bored", color: "#A855F7" },
  stress: { emoji: "😫", label: "Stress", color: "#EF4444" },
  impulse: { emoji: "⚡", label: "Impulse", color: "#EAB308" },
};

export interface BehavioralResponse {
  archetype: string;
  creep: { months: string[]; income: string[]; spending: string[] };
  reasons: Array<{
    id: string;
    emoji: string;
    label: string;
    color: string;
    total: string;
  }>;
  taggedTransactions: Array<{
    id: string;
    merchant: string;
    amount: string;
    date: string;
    reasonId: string;
  }>;
  challenges: Array<{
    title: string;
    goal: string;
    progressPercent: number;
    daysRemaining: number;
    complete: boolean;
    color: string | null;
  }>;
  streaks: Array<{
    label: string;
    currentDays: number;
    maxDays: number;
    color: string | null;
  }>;
}

export async function getBehavioral(
  userId: string,
): Promise<BehavioralResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const db = getDb();

  const monthly = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'income' and ${transactions.isTransfer} = false then abs(${transactions.amount}) else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.userId, ctx.userIds),
        eq(transactions.pending, false),
      ),
    )
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);
  const lastTen = monthly.slice(-10);

  const tagged = await db
    .select({
      id: transactions.id,
      merchant: transactions.merchantName,
      name: transactions.name,
      amount: transactions.amount,
      date: transactions.date,
      reasonId: transactionReasons.reasonId,
    })
    .from(transactionReasons)
    .innerJoin(transactions, eq(transactionReasons.transactionId, transactions.id))
    .where(inArray(transactionReasons.userId, ctx.userIds));

  const reasonTotals = new Map<string, number>();
  for (const t of tagged) {
    reasonTotals.set(
      t.reasonId,
      (reasonTotals.get(t.reasonId) ?? 0) + Number.parseFloat(t.amount),
    );
  }

  const [dna] = await db
    .select({ archetype: spendingDna.archetype })
    .from(spendingDna)
    .where(inArray(spendingDna.userId, ctx.userIds))
    .limit(1);

  const challengeRows = await db
    .select()
    .from(challenges)
    .where(inArray(challenges.userId, ctx.userIds));
  const streakRows = await db
    .select()
    .from(habitStreaks)
    .where(inArray(habitStreaks.userId, ctx.userIds));

  return {
    archetype: dna?.archetype ?? "The Spender",
    creep: {
      months: lastTen.map((r) => r.month.slice(5)),
      income: lastTen.map((r) => formatMoneyAmount(r.income)),
      spending: lastTen.map((r) => formatMoneyAmount(r.spending)),
    },
    reasons: Object.entries(REASON_META).map(([id, meta]) => ({
      id,
      emoji: meta.emoji,
      label: meta.label,
      color: meta.color,
      total: formatMoneyAmount(reasonTotals.get(id) ?? 0),
    })),
    taggedTransactions: tagged.map((t) => ({
      id: t.id,
      merchant: t.merchant ?? t.name,
      amount: formatMoneyAmount(t.amount),
      date: t.date,
      reasonId: t.reasonId,
    })),
    challenges: challengeRows.map((c) => ({
      title: c.title,
      goal: c.goal,
      progressPercent: c.progressPercent,
      daysRemaining: c.daysRemaining,
      complete: c.complete,
      color: c.color,
    })),
    streaks: streakRows.map((s) => ({
      label: s.label,
      currentDays: s.currentDays,
      maxDays: s.maxDays,
      color: s.color,
    })),
  };
}
