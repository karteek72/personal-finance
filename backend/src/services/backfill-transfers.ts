import { eq, or } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";
import {
  CREDIT_CARD_PAYMENT_SUBCATEGORY,
  INTERNAL_TRANSFER_CATEGORY,
  matchesCreditCardPaymentText,
  resolveInternalTransfer,
} from "./transfer-classification.js";

const log = createLogger("backfill.transfers");

/**
 * Idempotent: marks credit card bill payments and other internal transfers
 * so they are excluded from spend totals (charges on the card are the real spend).
 */
export async function backfillInternalTransfers(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      id: transactions.id,
      category: transactions.category,
      subCategory: transactions.subCategory,
      merchantName: transactions.merchantName,
      name: transactions.name,
      isTransfer: transactions.isTransfer,
      transactionType: transactions.transactionType,
    })
    .from(transactions)
    .where(
      or(
        eq(transactions.isTransfer, false),
        eq(transactions.category, "Financial & Insurance"),
      ),
    );

  let updated = 0;
  for (const row of rows) {
    const resolved = resolveInternalTransfer({
      category: row.category,
      subCategory: row.subCategory,
      name: row.name,
      merchantName: row.merchantName,
      pfcDetailed: null,
    });

    const byName =
      !resolved && matchesCreditCardPaymentText(row.name, row.merchantName)
        ? {
            category: INTERNAL_TRANSFER_CATEGORY,
            subCategory: CREDIT_CARD_PAYMENT_SUBCATEGORY,
            transactionType: "transfer" as const,
            isTransfer: true as const,
          }
        : null;

    const next = resolved ?? byName;
    if (!next) {
      continue;
    }

    if (
      row.isTransfer &&
      row.transactionType === "transfer" &&
      row.category === next.category &&
      row.subCategory === next.subCategory
    ) {
      continue;
    }

    await db
      .update(transactions)
      .set({
        category: next.category,
        subCategory: next.subCategory,
        transactionType: "transfer",
        isTransfer: true,
      })
      .where(eq(transactions.id, row.id));
    updated += 1;
  }

  if (updated > 0) {
    log.info({ scanned: rows.length, updated }, "backfilled internal transfers");
  }

  return updated;
}
