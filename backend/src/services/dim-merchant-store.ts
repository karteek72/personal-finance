import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { dimMerchant, transactions } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";
import { normalizeMerchant } from "./merchant-normalizer.js";

const log = createLogger("dim-merchant");

/** In-memory cache for batch ingest (userId:canonicalKey → merchant id). */
export class MerchantResolver {
  private readonly cache = new Map<string, string>();

  async resolve(
    db: ReturnType<typeof getDb>,
    userId: string,
    merchantName: string | null | undefined,
    name: string,
  ): Promise<string | null> {
    const normalized = normalizeMerchant(merchantName, name);
    if (!normalized) {
      return null;
    }

    const cacheKey = `${userId}:${normalized.canonicalKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [row] = await db
      .insert(dimMerchant)
      .values({
        userId,
        displayName: normalized.displayName,
        canonicalKey: normalized.canonicalKey,
      })
      .onConflictDoUpdate({
        target: [dimMerchant.userId, dimMerchant.canonicalKey],
        set: { displayName: normalized.displayName },
      })
      .returning({ id: dimMerchant.id });

    if (!row) {
      return null;
    }

    this.cache.set(cacheKey, row.id);
    return row.id;
  }
}

/** Set merchant_id on transactions that were inserted before dim_merchant existed. */
export async function backfillTransactionMerchantIds(
  userId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      id: transactions.id,
      merchantName: transactions.merchantName,
      name: transactions.name,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), isNull(transactions.merchantId)),
    );

  if (rows.length === 0) {
    return 0;
  }

  const resolver = new MerchantResolver();
  let updated = 0;

  for (const row of rows) {
    const merchantId = await resolver.resolve(
      db,
      userId,
      row.merchantName,
      row.name,
    );
    if (!merchantId) {
      continue;
    }

    await db
      .update(transactions)
      .set({ merchantId })
      .where(eq(transactions.id, row.id));
    updated += 1;
  }

  if (updated > 0) {
    log.info({ userId, updated }, "backfilled transaction merchant_id");
  }

  return updated;
}
