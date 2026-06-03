import { inArray, sql } from "drizzle-orm";
import type { getDb } from "../../db/client.js";
import { transactions } from "../../db/schema.js";

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
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
  source: "plaid";
};

export async function upsertPlaidTransactionBatch(
  db: ReturnType<typeof getDb>,
  rows: PlaidTransactionInsert[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await db
    .insert(transactions)
    .values(rows)
    .onConflictDoUpdate({
      target: [transactions.accountId, transactions.externalId],
      set: {
        date: sql`excluded.date`,
        name: sql`excluded.name`,
        merchantName: sql`excluded.merchant_name`,
        amount: sql`excluded.amount`,
        category: sql`excluded.category`,
        transactionType: sql`excluded.transaction_type`,
        isTransfer: sql`excluded.is_transfer`,
        pending: sql`excluded.pending`,
        source: sql`excluded.source`,
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
