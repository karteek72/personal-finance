import { and, eq, inArray, sql } from "drizzle-orm";
import type { getDb } from "../../db/client.js";
import { transactions } from "../../db/schema.js";
import { bankingDedupFingerprint } from "../import/fingerprint.js";

export const PLAID_TXN_BATCH_SIZE = 100;

export type PlaidTransactionInsert = {
  userId: string;
  accountId: string;
  externalId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  category: string;
  subCategory: string | null;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
  source: "plaid";
};

type PlaidRowWithFingerprint = PlaidTransactionInsert & {
  dedupFingerprint: string;
};

async function filterPlaidDedupRows(
  db: ReturnType<typeof getDb>,
  rows: PlaidTransactionInsert[],
): Promise<PlaidRowWithFingerprint[]> {
  const kept: PlaidRowWithFingerprint[] = [];

  for (const row of rows) {
    const dedupFingerprint = bankingDedupFingerprint(
      row.accountId,
      row.date,
      row.amount,
      row.name,
    );

    const hit = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, row.accountId),
          eq(transactions.dedupFingerprint, dedupFingerprint),
        ),
      )
      .limit(1);

    if (hit[0]) {
      continue;
    }

    kept.push({ ...row, dedupFingerprint });
  }

  return kept;
}

export async function upsertPlaidTransactionBatch(
  db: ReturnType<typeof getDb>,
  rows: PlaidTransactionInsert[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const filtered = await filterPlaidDedupRows(db, rows);
  if (filtered.length === 0) {
    return;
  }

  await db
    .insert(transactions)
    .values(filtered)
    .onConflictDoUpdate({
      target: [transactions.accountId, transactions.externalId],
      set: {
        date: sql`excluded.date`,
        name: sql`excluded.name`,
        merchantName: sql`excluded.merchant_name`,
        amount: sql`excluded.amount`,
        category: sql`excluded.category`,
        subCategory: sql`excluded.sub_category`,
        transactionType: sql`excluded.transaction_type`,
        isTransfer: sql`excluded.is_transfer`,
        pending: sql`excluded.pending`,
        source: sql`excluded.source`,
        dedupFingerprint: sql`excluded.dedup_fingerprint`,
      },
    });
}

export async function deletePlaidTransactionsByExternalIds(
  db: ReturnType<typeof getDb>,
  externalIds: string[],
): Promise<number> {
  if (externalIds.length === 0) {
    return 0;
  }

  await db
    .delete(transactions)
    .where(inArray(transactions.externalId, externalIds));

  return externalIds.length;
}
