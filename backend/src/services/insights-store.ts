import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  challenges,
  habitStreaks,
  spendingDna,
  transactionReasons,
  transactions,
} from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import {
  paginateInMemory,
  type Page,
  type ParsedListQuery,
} from "../lib/list-query.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { computePatternsFromTransactions } from "./compute-patterns.js";
import { computeWellnessFromTransactions } from "./compute-wellness.js";
import { resolveHouseholdContext } from "./household-access.js";

export interface WellnessResponse {
  score: number;
  delta: number;
  confidence: number;
  history: Array<{ month: string; score: number }>;
  dimensions: Array<{
    name: string;
    score: number;
    weight: number;
    description: string;
    trend: string;
    confidence?: number;
    caveats?: string[];
  }>;
  isLive: boolean;
}

export function emptyWellnessResponse(): WellnessResponse {
  return {
    score: 0,
    delta: 0,
    confidence: 0,
    history: [],
    dimensions: [],
    isLive: false,
  };
}

export async function getWellness(userId: string): Promise<WellnessResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return emptyWellnessResponse();
  }
  return computeWellnessFromTransactions(ctx.userIds, userId);
}

export interface DnaResponse {
  archetype: string;
  narrative: string;
  peerRarity: string | null;
  axes: Array<{ label: string; you: number; peers: number }>;
  isLive?: boolean;
}

export function emptyDnaResponse(): DnaResponse {
  return {
    archetype: "—",
    narrative: "",
    peerRarity: null,
    axes: [],
    isLive: false,
  };
}

export async function getDna(userId: string): Promise<DnaResponse | null> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return null;
  }
  const { computeDnaFromTransactions } = await import("./compute-dna.js");
  return computeDnaFromTransactions(ctx.userIds);
}

export interface PatternRow {
  label: string;
  value: string;
  description: string;
  severity: string;
}

export const PATTERN_SORTABLE = ["label", "value"] as const;

export interface PatternsResponse {
  dayOfWeek: Array<{ day: string; value: string }>;
  patterns: Page<PatternRow>;
}

function patternSortKey(column: string): (row: PatternRow) => number | string {
  switch (column) {
    case "label":
      return (r) => r.label.toLowerCase();
    default:
      return (r) => Number.parseFloat(r.value);
  }
}

export async function getPatterns(
  userId: string,
  q: ParsedListQuery,
): Promise<PatternsResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { hasActiveAccounts } = await resolveActiveAccountScope(ctx.userIds);
  if (!hasActiveAccounts) {
    return {
      dayOfWeek: [],
      patterns: paginateInMemory([], q, { sortKey: patternSortKey }),
    };
  }
  const computed = await computePatternsFromTransactions(ctx.userIds);
  return {
    dayOfWeek: computed.dayOfWeek,
    patterns: paginateInMemory(computed.patterns, q, {
      sortKey: patternSortKey,
      textFilter: (row, needle) => row.label.toLowerCase().includes(needle),
    }),
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
    id: string;
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
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(ctx.userIds);
  const db = getDb();

  if (!hasActiveAccounts) {
    return {
      archetype: "—",
      creep: { months: [], income: [], spending: [] },
      reasons: Object.entries(REASON_META).map(([id, meta]) => ({
        id,
        emoji: meta.emoji,
        label: meta.label,
        color: meta.color,
        total: "0.00",
      })),
      taggedTransactions: [],
      challenges: [],
      streaks: [],
    };
  }

  const txScope = drizzleActiveTransactionWhere(ctx.userIds, accountIds);

  const monthly = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'income' and ${transactions.isTransfer} = false then abs(${transactions.amount}) else 0 end), 0)`,
      spending: sql<string>`coalesce(sum(case when ${transactions.transactionType} = 'expense' and ${transactions.isTransfer} = false then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(and(txScope, eq(transactions.pending, false)))
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
    .where(
      and(
        inArray(transactionReasons.userId, ctx.userIds),
        inArray(transactions.accountId, accountIds),
      ),
    );

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
    .where(
      and(
        inArray(challenges.userId, ctx.userIds),
        eq(challenges.dismissed, false),
      ),
    );
  const streakRows = await db
    .select()
    .from(habitStreaks)
    .where(inArray(habitStreaks.userId, ctx.userIds));

  return {
    archetype: dna?.archetype ?? "—",
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
      id: c.id,
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
