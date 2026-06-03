import { and, eq } from "drizzle-orm";
import type { CategoryRule } from "../category-rules.js";
import { classifyBankingTransaction } from "../classify-banking-transaction.js";
import type { getDb } from "../../db/client.js";
import { transactions } from "../../db/schema.js";
import { bankingDedupFingerprint } from "./fingerprint.js";
import type { ParsedBankingTransaction } from "./types.js";

export const BANKING_TXN_BATCH_SIZE = 500;

export type BankingTransactionSource = "qfx" | "ofx" | "csv";

export interface PersistBankingResult {
  inserted: number;
  skipped: number;
}

export async function persistBankingTransactions(
  db: ReturnType<typeof getDb>,
  userId: string,
  accountId: string,
  txns: ParsedBankingTransaction[],
  source: BankingTransactionSource,
  categoryRules: Map<string, CategoryRule>,
): Promise<PersistBankingResult> {
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < txns.length; i += BANKING_TXN_BATCH_SIZE) {
    const batch = txns.slice(i, i + BANKING_TXN_BATCH_SIZE);

    for (const txn of batch) {
      const dedupFingerprint = bankingDedupFingerprint(
        accountId,
        txn.date,
        txn.amount,
        txn.name,
      );

      const fingerprintHit = await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.accountId, accountId),
            eq(transactions.dedupFingerprint, dedupFingerprint),
          ),
        )
        .limit(1);

      if (fingerprintHit[0]) {
        skipped++;
        continue;
      }

      const classified = classifyBankingTransaction({
        categoryHint: txn.category,
        name: txn.name,
        merchantName: txn.merchantName,
        categoryRules,
        transactionType: txn.transactionType,
        isTransfer: txn.isTransfer,
      });

      const result = await db
        .insert(transactions)
        .values({
          userId,
          accountId,
          externalId: txn.externalId,
          date: txn.date,
          name: txn.name,
          merchantName: txn.merchantName,
          amount: txn.amount,
          category: classified.category,
          subCategory: classified.subCategory,
          transactionType: classified.transactionType,
          isTransfer: classified.isTransfer,
          pending: false,
          source,
          dedupFingerprint,
        })
        .onConflictDoNothing({
          target: [transactions.accountId, transactions.externalId],
        })
        .returning({ id: transactions.id });

      if (result.length > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }
  }

  return { inserted, skipped };
}
