import { and, eq, inArray } from "drizzle-orm";
import { isValidCategory } from "../config/categories.js";
import { getDb } from "../db/client.js";
import { merchantCategoryRules, transactions } from "../db/schema.js";
import { AppError } from "../lib/errors.js";

/** Stable key for matching merchant rules across transactions. */
export function normalizeMerchantKey(
  merchantName: string | null | undefined,
  name: string,
): string {
  const raw = (merchantName?.trim() || name.trim()).toLowerCase();
  return raw.replace(/\s+/g, " ");
}

export async function getMerchantCategoryRulesMap(
  userId: string,
): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db
    .select({
      merchantKey: merchantCategoryRules.merchantKey,
      category: merchantCategoryRules.category,
    })
    .from(merchantCategoryRules)
    .where(eq(merchantCategoryRules.userId, userId));

  return new Map(rows.map((row) => [row.merchantKey, row.category]));
}

export function applyMerchantCategoryRule(
  rules: Map<string, string>,
  merchantName: string | null | undefined,
  name: string,
  defaultCategory: string,
): string {
  const key = normalizeMerchantKey(merchantName, name);
  return rules.get(key) ?? defaultCategory;
}

export async function upsertMerchantCategoryRule(
  userId: string,
  merchantKey: string,
  category: string,
): Promise<void> {
  if (!isValidCategory(category)) {
    throw AppError.validation(`Invalid category: ${category}`);
  }

  const db = getDb();
  await db
    .insert(merchantCategoryRules)
    .values({
      userId,
      merchantKey,
      category,
    })
    .onConflictDoUpdate({
      target: [merchantCategoryRules.userId, merchantCategoryRules.merchantKey],
      set: {
        category,
        updatedAt: new Date(),
      },
    });
}

export async function applyCategoryToMatchingTransactions(
  userId: string,
  merchantKey: string,
  category: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      id: transactions.id,
      merchantName: transactions.merchantName,
      name: transactions.name,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const ids = rows
    .filter(
      (row) => normalizeMerchantKey(row.merchantName, row.name) === merchantKey,
    )
    .map((row) => row.id);

  if (ids.length === 0) {
    return 0;
  }

  await db
    .update(transactions)
    .set({ category })
    .where(inArray(transactions.id, ids));

  return ids.length;
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  category: string,
  rememberForMerchant: boolean,
): Promise<{
  transaction: {
    id: string;
    category: string;
    merchantKey: string;
  };
  merchantTransactionsUpdated: number;
}> {
  if (!isValidCategory(category)) {
    throw AppError.validation(`Invalid category: ${category}`);
  }

  const db = getDb();
  const [txn] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId)),
    )
    .limit(1);

  if (!txn) {
    throw AppError.notFound("Transaction not found");
  }

  const merchantKey = normalizeMerchantKey(txn.merchantName, txn.name);

  await db
    .update(transactions)
    .set({ category })
    .where(eq(transactions.id, transactionId));

  let merchantTransactionsUpdated = 0;

  if (rememberForMerchant) {
    await upsertMerchantCategoryRule(userId, merchantKey, category);
    merchantTransactionsUpdated = await applyCategoryToMatchingTransactions(
      userId,
      merchantKey,
      category,
    );
  }

  return {
    transaction: {
      id: transactionId,
      category,
      merchantKey,
    },
    merchantTransactionsUpdated,
  };
}
