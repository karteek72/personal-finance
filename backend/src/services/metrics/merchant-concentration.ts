import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { dimMerchant, transactions } from "../../db/schema.js";
import { roundPercent } from "../../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "../active-account-scope.js";
import { resolveHouseholdContext } from "../household-access.js";
import { INTERNAL_TRANSFER_CATEGORY } from "../transfer-classification.js";

export interface MerchantConcentrationMetrics {
  /** Herfindahl-Hirschman Index over merchant spend shares (0–1). */
  hhi: number;
  /** Combined spend share of the top 5 merchants (0–100). */
  top5Share: number;
  merchantCount: number;
  trailingDays: number;
  isLive: boolean;
}

function trailingFromDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Merchant concentration (HHI + top-5 share) over trailing expense outflow,
 * grouped by dim_merchant canonical keys.
 */
export async function getMerchantConcentrationMetrics(
  userId: string,
  trailingDays = 90,
): Promise<MerchantConcentrationMetrics> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );

  if (!hasActiveAccounts) {
    return {
      hhi: 0,
      top5Share: 0,
      merchantCount: 0,
      trailingDays,
      isLive: false,
    };
  }

  const db = getDb();
  const from = trailingFromDate(trailingDays);

  const rows = await db
    .select({
      merchantId: transactions.merchantId,
      displayName: dimMerchant.displayName,
      total: sql<string>`sum(${transactions.amount}::numeric)`.as("total"),
    })
    .from(transactions)
    .leftJoin(dimMerchant, eq(transactions.merchantId, dimMerchant.id))
    .where(
      and(
        drizzleActiveTransactionWhere(ctx.userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        gte(transactions.date, from),
        sql`${transactions.merchantId} IS NOT NULL`,
      ),
    )
    .groupBy(transactions.merchantId, dimMerchant.displayName);

  const totals = rows
    .map((row) => Number.parseFloat(row.total))
    .filter((value) => Number.isFinite(value) && value > 0);

  const grandTotal = totals.reduce((sum, value) => sum + value, 0);
  if (grandTotal <= 0 || totals.length === 0) {
    return {
      hhi: 0,
      top5Share: 0,
      merchantCount: 0,
      trailingDays,
      isLive: false,
    };
  }

  const shares = totals
    .map((value) => value / grandTotal)
    .sort((a, b) => b - a);

  const hhi = roundPercent(
    shares.reduce((sum, share) => sum + share * share, 0),
  );
  const top5Share = roundPercent(
    shares.slice(0, 5).reduce((sum, share) => sum + share, 0) * 100,
  );

  return {
    hhi,
    top5Share,
    merchantCount: shares.length,
    trailingDays,
    isLive: true,
  };
}
