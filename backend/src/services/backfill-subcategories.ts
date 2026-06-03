import { eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";
import { classificationForStorage } from "./infer-subcategory.js";

const log = createLogger("backfill.subcategories");

/** Idempotent: fills category/sub_category on rows where sub_category is still null. */
export async function backfillSubCategories(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      id: transactions.id,
      category: transactions.category,
      merchantName: transactions.merchantName,
      name: transactions.name,
    })
    .from(transactions)
    .where(isNull(transactions.subCategory));

  if (rows.length === 0) {
    return 0;
  }

  let updated = 0;
  for (const row of rows) {
    const inferred = classificationForStorage(
      row.category,
      row.merchantName,
      row.name,
      row.category,
      null,
    );
    if (!inferred.subCategory && inferred.category === row.category) {
      continue;
    }
    await db
      .update(transactions)
      .set({
        category: inferred.category,
        subCategory: inferred.subCategory,
      })
      .where(eq(transactions.id, row.id));
    updated += 1;
  }

  if (updated > 0) {
    log.info({ scanned: rows.length, updated }, "backfilled transaction subcategories");
  }

  return updated;
}
