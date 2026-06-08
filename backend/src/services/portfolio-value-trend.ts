import { and, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { holdingsSnapshots } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";

export interface PortfolioValuePoint {
  month: string;
  value: string;
}

export interface PortfolioValueTrend {
  points: PortfolioValuePoint[];
  granularity: "monthly";
  caveats: string[];
}

/**
 * Monthly portfolio value from holdings snapshots (last day per month).
 * Honors optional account filter when snapshots exist for that account.
 */
export async function getPortfolioValueTrend(
  userIds: string[],
  accountId?: string,
): Promise<PortfolioValueTrend> {
  const caveats: string[] = [];
  if (userIds.length === 0) {
    return { points: [], granularity: "monthly", caveats: ["No household members."] };
  }

  const db = getDb();
  const conditions = [inArray(holdingsSnapshots.userId, userIds)];
  if (accountId) {
    conditions.push(sql`${holdingsSnapshots.accountId} = ${accountId}`);
  }

  const rows = await db
    .select({
      asOfDate: holdingsSnapshots.asOfDate,
      marketValue: holdingsSnapshots.marketValue,
    })
    .from(holdingsSnapshots)
    .where(and(...conditions));

  if (rows.length === 0) {
    caveats.push(
      "No holdings snapshots yet — portfolio trend appears after brokerage sync writes daily snapshots.",
    );
    return { points: [], granularity: "monthly", caveats };
  }

  const byMonth = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const month = row.asOfDate.slice(0, 7);
    const day = row.asOfDate;
    const value = Number.parseFloat(row.marketValue);
    if (!Number.isFinite(value)) continue;

    let days = byMonth.get(month);
    if (!days) {
      days = new Map();
      byMonth.set(month, days);
    }
    const existing = days.get(day) ?? 0;
    days.set(day, existing + value);
  }

  const points: PortfolioValuePoint[] = [...byMonth.entries()]
    .map(([month, days]) => {
      const lastDay = [...days.keys()].sort().at(-1)!;
      return {
        month,
        value: formatMoneyAmount(days.get(lastDay) ?? 0),
      };
    })
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  if (points.length < 2) {
    caveats.push(
      "Trend needs at least two months of snapshot history for a meaningful chart.",
    );
  }

  return { points, granularity: "monthly", caveats };
}
