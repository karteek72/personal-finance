import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { dimMerchant, transactions } from "../db/schema.js";
import { formatMoneyAmount, roundDecimal, roundPercent } from "../lib/money.js";
import {
  buildPage,
  compareBy,
  type Page,
  type ParsedListQuery,
} from "../lib/list-query.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

/** Columns the client may sort by (server-whitelisted). */
export const MERCHANT_SORTABLE = [
  "total",
  "visits",
  "trend",
  "name",
  "avgTransaction",
  "lastSeen",
] as const;

const MERCHANT_EMOJI: Record<string, string> = {
  Amazon: "📦",
  "Whole Foods Market": "🥑",
  DoorDash: "🍽️",
  Shell: "⛽",
  Starbucks: "☕",
  Uber: "🚗",
};

export interface MerchantRow {
  name: string;
  emoji: string;
  visits: number;
  total: string;
  avgTransaction: string;
  /** Share of total merchant spend, 0-100. */
  share: number;
  /** Month-over-month % change of the last two months in the trail. */
  trend: number;
  lastSeen: string;
  /** Last-6-month spend trail for the sparkline. */
  trail: number[];
}

export interface MerchantsSummary {
  merchantCount: number;
  totalSpend: string;
  topMerchant: { name: string; total: string } | null;
  mostVisited: { name: string; visits: number } | null;
  fastestGrowing: { name: string; trend: number } | null;
}

export interface MerchantsTableResponse extends Page<MerchantRow> {
  summary: MerchantsSummary;
  isLive: boolean;
}

interface MerchantAgg {
  name: string;
  total: number;
  visits: number;
  lastSeen: string;
  months: Map<string, number>;
}

function emptySummary(): MerchantsSummary {
  return {
    merchantCount: 0,
    totalSpend: "0.00",
    topMerchant: null,
    mostVisited: null,
    fastestGrowing: null,
  };
}

function sortKey(column: string): (row: MerchantRow) => number | string {
  switch (column) {
    case "name":
      return (r) => r.name.toLowerCase();
    case "visits":
      return (r) => r.visits;
    case "trend":
      return (r) => r.trend;
    case "avgTransaction":
      return (r) => Number.parseFloat(r.avgTransaction);
    case "lastSeen":
      return (r) => r.lastSeen;
    default:
      return (r) => Number.parseFloat(r.total);
  }
}

/**
 * Paginated, sortable, filterable merchant report. Replaces the old top-6
 * `.slice(0, 6)` cap (defect B-merchants). All ranking/aggregation happens here
 * so web and iOS render identical rows.
 *
 * Merchant identity uses dim_merchant when merchant_id is set; falls back to
 * raw merchant_name for legacy rows pending backfill.
 */
export async function listMerchants(
  userId: string,
  q: ParsedListQuery,
): Promise<MerchantsTableResponse> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  const emptyPage = buildPage<MerchantRow>([], 0, q);
  if (!hasActiveAccounts) {
    return { ...emptyPage, summary: emptySummary(), isLive: false };
  }

  const db = getDb();
  const conditions = [
    drizzleActiveTransactionWhere(ctx.userIds, accountIds),
    eq(transactions.pending, false),
    eq(transactions.transactionType, "expense"),
    eq(transactions.isTransfer, false),
    sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
  ];
  if (q.from) conditions.push(gte(transactions.date, q.from));
  if (q.to) conditions.push(lte(transactions.date, q.to));

  const rows = await db
    .select({
      merchant: sql<string>`coalesce(${dimMerchant.displayName}, ${transactions.merchantName}, ${transactions.name})`.as(
        "merchant",
      ),
      amount: transactions.amount,
      date: transactions.date,
    })
    .from(transactions)
    .leftJoin(dimMerchant, eq(transactions.merchantId, dimMerchant.id))
    .where(and(...conditions));

  const allMonths = [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort();
  const last6 = allMonths.slice(-6);

  const needle = q.q?.toLowerCase();
  const agg = new Map<string, MerchantAgg>();
  for (const r of rows) {
    if (!r.merchant) continue;
    if (needle && !r.merchant.toLowerCase().includes(needle)) continue;
    const entry =
      agg.get(r.merchant) ??
      ({
        name: r.merchant,
        total: 0,
        visits: 0,
        lastSeen: r.date,
        months: new Map<string, number>(),
      } satisfies MerchantAgg);
    const amt = Number.parseFloat(r.amount);
    if (Number.isFinite(amt)) {
      entry.total += amt;
      entry.visits += 1;
      const mk = r.date.slice(0, 7);
      entry.months.set(mk, (entry.months.get(mk) ?? 0) + amt);
    }
    if (r.date > entry.lastSeen) entry.lastSeen = r.date;
    agg.set(r.merchant, entry);
  }

  const grandTotal = [...agg.values()].reduce((s, e) => s + e.total, 0);

  const all: MerchantRow[] = [...agg.values()].map((e) => {
    const trail = last6.map((mk) => roundDecimal(e.months.get(mk) ?? 0));
    const prev = trail.length >= 2 ? trail[trail.length - 2]! : 0;
    const curr = trail.length >= 1 ? trail[trail.length - 1]! : 0;
    const trend = prev > 0 ? roundPercent(((curr - prev) / prev) * 100) : 0;
    return {
      name: e.name,
      emoji: MERCHANT_EMOJI[e.name] ?? "🏬",
      visits: e.visits,
      total: formatMoneyAmount(e.total),
      avgTransaction: formatMoneyAmount(e.visits > 0 ? e.total / e.visits : 0),
      share: grandTotal > 0 ? roundPercent((e.total / grandTotal) * 100) : 0,
      trend,
      lastSeen: e.lastSeen,
      trail,
    };
  });

  // Summary is computed over the full (filtered) set, independent of pagination.
  const byTotal = [...all].sort(compareBy(sortKey("total"), "desc"));
  const byVisits = [...all].sort(compareBy(sortKey("visits"), "desc"));
  const byTrend = [...all].sort(compareBy(sortKey("trend"), "desc"));
  const summary: MerchantsSummary = {
    merchantCount: all.length,
    totalSpend: formatMoneyAmount(grandTotal),
    topMerchant: byTotal[0]
      ? { name: byTotal[0].name, total: byTotal[0].total }
      : null,
    mostVisited: byVisits[0]
      ? { name: byVisits[0].name, visits: byVisits[0].visits }
      : null,
    fastestGrowing: byTrend[0]
      ? { name: byTrend[0].name, trend: byTrend[0].trend }
      : null,
  };

  const sorted = [...all].sort(compareBy(sortKey(q.sort), q.dir));
  const total = sorted.length;
  const pageRows = sorted.slice(q.offset, q.offset + q.pageSize);

  return {
    ...buildPage(pageRows, total, q),
    summary,
    isLive: all.length > 0,
  };
}
