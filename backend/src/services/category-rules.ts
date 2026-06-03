import { and, eq, inArray } from "drizzle-orm";
import { isValidCategory, isValidSubCategory } from "../config/categories.js";
import { getDb } from "../db/client.js";
import { merchantCategoryRules, transactions } from "../db/schema.js";
import { AppError } from "../lib/errors.js";

export interface CategoryRule {
  category: string;
  subCategory: string | null;
}

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
): Promise<Map<string, CategoryRule>> {
  const db = getDb();
  const rows = await db
    .select({
      merchantKey: merchantCategoryRules.merchantKey,
      category: merchantCategoryRules.category,
      subCategory: merchantCategoryRules.subCategory,
    })
    .from(merchantCategoryRules)
    .where(eq(merchantCategoryRules.userId, userId));

  return new Map(
    rows.map((row) => [
      row.merchantKey,
      { category: row.category, subCategory: row.subCategory ?? null },
    ]),
  );
}

/**
 * Apply a merchant rule if one exists.
 *
 * When a rule exists but has no stored subCategory, the Plaid-derived
 * subCategory is preserved IF the rule's category matches the default
 * (i.e. the user didn't change the parent, only wanted to remember it).
 */
export function applyMerchantCategoryRule(
  rules: Map<string, CategoryRule>,
  merchantName: string | null | undefined,
  name: string,
  defaultCategory: string,
  defaultSubCategory: string | null,
): CategoryRule {
  const key = normalizeMerchantKey(merchantName, name);
  const rule = rules.get(key);
  if (!rule) {
    return { category: defaultCategory, subCategory: defaultSubCategory };
  }
  const subCategory =
    rule.subCategory ??
    (rule.category === defaultCategory ? defaultSubCategory : null);
  return { category: rule.category, subCategory };
}

export async function upsertMerchantCategoryRule(
  userId: string,
  merchantKey: string,
  category: string,
  subCategory: string | null,
): Promise<void> {
  if (!isValidCategory(category)) {
    throw AppError.validation(`Invalid category: ${category}`);
  }
  if (subCategory !== null && !isValidSubCategory(category, subCategory)) {
    throw AppError.validation(
      `Invalid subcategory "${subCategory}" for category "${category}"`,
    );
  }

  const db = getDb();
  await db
    .insert(merchantCategoryRules)
    .values({ userId, merchantKey, category, subCategory })
    .onConflictDoUpdate({
      target: [merchantCategoryRules.userId, merchantCategoryRules.merchantKey],
      set: {
        category,
        subCategory,
        updatedAt: new Date(),
      },
    });
}

export async function applyCategoryToMatchingTransactions(
  userId: string,
  merchantKey: string,
  category: string,
  subCategory: string | null,
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
    .set({ category, subCategory })
    .where(inArray(transactions.id, ids));

  return ids.length;
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  category: string,
  subCategory: string | null,
  rememberForMerchant: boolean,
): Promise<{
  transaction: {
    id: string;
    category: string;
    subCategory: string | null;
    merchantKey: string;
  };
  merchantTransactionsUpdated: number;
}> {
  if (!isValidCategory(category)) {
    throw AppError.validation(`Invalid category: ${category}`);
  }
  if (subCategory !== null && !isValidSubCategory(category, subCategory)) {
    throw AppError.validation(
      `Invalid subcategory "${subCategory}" for category "${category}"`,
    );
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
    .set({ category, subCategory })
    .where(eq(transactions.id, transactionId));

  let merchantTransactionsUpdated = 0;

  if (rememberForMerchant) {
    await upsertMerchantCategoryRule(userId, merchantKey, category, subCategory);
    merchantTransactionsUpdated = await applyCategoryToMatchingTransactions(
      userId,
      merchantKey,
      category,
      subCategory,
    );
  }

  return {
    transaction: {
      id: transactionId,
      category,
      subCategory,
      merchantKey,
    },
    merchantTransactionsUpdated,
  };
}
