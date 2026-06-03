import { sql } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import type { getDb } from "../../db/client.js";
import {
  investmentTransactions,
  securities,
} from "../../db/schema.js";
import { investmentDedupFingerprint } from "./fingerprint.js";
import type { ParsedInvestmentTransaction } from "./types.js";

export const INVESTMENT_TXN_BATCH_SIZE = 500;

export interface PersistInvestmentResult {
  inserted: number;
  skipped: number;
}

async function upsertSecurity(
  db: ReturnType<typeof getDb>,
  ticker: string,
  name: string,
  assetType: "equity" | "etf" | "crypto" = "equity",
): Promise<string> {
  const upper = ticker.toUpperCase();
  const [row] = await db
    .insert(securities)
    .values({
      ticker: upper,
      name: name || upper,
      assetType,
      currentPrice: "0",
    })
    .onConflictDoUpdate({
      target: securities.ticker,
      set: {
        name: sql`excluded.name`,
        assetType: sql`excluded.asset_type`,
        asOf: sql`now()`,
      },
    })
    .returning({ id: securities.id });

  if (!row) {
    throw new Error(`Failed to upsert security ${upper}`);
  }

  return row.id;
}

export async function persistInvestmentTransactions(
  db: ReturnType<typeof getDb>,
  userId: string,
  accountId: string,
  txns: ParsedInvestmentTransaction[],
): Promise<PersistInvestmentResult> {
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < txns.length; i += INVESTMENT_TXN_BATCH_SIZE) {
    const batch = txns.slice(i, i + INVESTMENT_TXN_BATCH_SIZE);

    for (const txn of batch) {
      let securityId: string | null = null;
      if (txn.ticker) {
        securityId = await upsertSecurity(
          db,
          txn.ticker,
          txn.securityName ?? txn.ticker,
          txn.assetType ?? "equity",
        );
      }

      const dedupFingerprint = investmentDedupFingerprint(
        accountId,
        txn.date,
        txn.type,
        txn.amount,
        txn.ticker,
        txn.quantity,
      );

      const fingerprintHit = await db
        .select({ id: investmentTransactions.id })
        .from(investmentTransactions)
        .where(
          and(
            eq(investmentTransactions.accountId, accountId),
            eq(investmentTransactions.dedupFingerprint, dedupFingerprint),
          ),
        )
        .limit(1);

      if (fingerprintHit[0]) {
        skipped++;
        continue;
      }

      const result = await db
        .insert(investmentTransactions)
        .values({
          userId,
          accountId,
          securityId,
          externalId: txn.externalId,
          date: txn.date,
          name: txn.name,
          type: txn.type,
          quantity: txn.quantity ?? null,
          price: txn.price ?? null,
          amount: txn.amount,
          fees: txn.fees,
          dedupFingerprint,
        })
        .onConflictDoNothing({
          target: [
            investmentTransactions.accountId,
            investmentTransactions.externalId,
          ],
        })
        .returning({ id: investmentTransactions.id });

      if (result.length > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }
  }

  return { inserted, skipped };
}
