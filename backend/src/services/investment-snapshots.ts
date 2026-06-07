import { and, eq, inArray } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import {
  getDb as getDefaultDb,
} from "../db/client.js";
import {
  holdings,
  holdingsSnapshots,
  securities,
  securityPrices,
} from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatClosePrice(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0000";
  }
  return value.toFixed(4);
}

function computeMarketValue(
  quantity: number,
  price: number,
  institutionValue: string | null,
): number {
  if (institutionValue != null) {
    const parsed = Number.parseFloat(institutionValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return quantity * price;
}

/** Idempotent daily security price + holdings snapshot writes for one account. */
export async function writeInvestmentSnapshotsForAccount(
  db: ReturnType<typeof getDb>,
  userId: string,
  accountId: string,
  asOfDate?: string,
): Promise<void> {
  const date = asOfDate ?? todayIsoDate();
  const rows = await db
    .select({
      securityId: holdings.securityId,
      quantity: holdings.quantity,
      costBasis: holdings.costBasis,
      institutionValue: holdings.institutionValue,
      currentPrice: securities.currentPrice,
    })
    .from(holdings)
    .innerJoin(securities, eq(holdings.securityId, securities.id))
    .where(and(eq(holdings.userId, userId), eq(holdings.accountId, accountId)));

  for (const row of rows) {
    const quantity = Number.parseFloat(row.quantity);
    const costPerUnit = Number.parseFloat(row.costBasis);
    const price = Number.parseFloat(row.currentPrice);
    if (!Number.isFinite(quantity) || quantity === 0) {
      continue;
    }

    const closePrice = formatClosePrice(price);
    await db
      .insert(securityPrices)
      .values({
        securityId: row.securityId,
        asOfDate: date,
        closePrice,
      })
      .onConflictDoUpdate({
        target: [securityPrices.securityId, securityPrices.asOfDate],
        set: { closePrice },
      });

    const marketValue = computeMarketValue(
      quantity,
      price,
      row.institutionValue,
    );
    const costBasisTotal = quantity * (Number.isFinite(costPerUnit) ? costPerUnit : 0);

    await db
      .insert(holdingsSnapshots)
      .values({
        userId,
        accountId,
        securityId: row.securityId,
        asOfDate: date,
        quantity: row.quantity,
        marketValue: formatMoneyAmount(marketValue),
        costBasisTotal: formatMoneyAmount(costBasisTotal),
      })
      .onConflictDoUpdate({
        target: [
          holdingsSnapshots.accountId,
          holdingsSnapshots.securityId,
          holdingsSnapshots.asOfDate,
        ],
        set: {
          quantity: row.quantity,
          marketValue: formatMoneyAmount(marketValue),
          costBasisTotal: formatMoneyAmount(costBasisTotal),
        },
      });
  }
}

export async function writeInvestmentSnapshotsForAccounts(
  userId: string,
  accountIds: string[],
  asOfDate?: string,
): Promise<void> {
  if (accountIds.length === 0) {
    return;
  }

  const db = getDefaultDb();
  const uniqueAccountIds = [...new Set(accountIds)];

  for (const accountId of uniqueAccountIds) {
    await writeInvestmentSnapshotsForAccount(db, userId, accountId, asOfDate);
  }
}

/** Remove portfolio snapshots when purging investment accounts. */
export async function deleteHoldingsSnapshotsForAccounts(
  accountIds: string[],
): Promise<void> {
  if (accountIds.length === 0) {
    return;
  }

  const db = getDefaultDb();
  await db
    .delete(holdingsSnapshots)
    .where(inArray(holdingsSnapshots.accountId, accountIds));
}
