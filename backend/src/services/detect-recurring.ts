import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { dimMerchant, transactions } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import { SUBSCRIPTION_CATEGORIES } from "./analytics-categories.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { categoryMeta } from "./category-meta.js";
import { normalizeMerchant } from "./merchant-normalizer.js";
import {
  applyRecurringLifecycleFields,
  type RecurringLifecycleStatus,
} from "./recurring-lifecycle.js";
import {
  buildRecurringFlags,
  buildRecurringSeries,
  detectFreeTrialJump,
  detectPriceCreep,
  markDuplicateFlags,
  type RecurringFlags,
} from "./recurring-engine.js";

export type { RecurringFlags };

export interface DetectedRecurringItem {
  merchantName: string;
  merchantKey: string;
  category: string;
  kind: "subscription" | "bill";
  amount: string;
  cadence: string;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  previousAmount: string | null;
  priceChanged: boolean;
  status: RecurringLifecycleStatus;
  brandColor: string | null;
  flags: RecurringFlags;
}

function merchantGroupKey(
  merchantId: string | null,
  merchantName: string | null,
  name: string,
): { key: string; displayName: string } | null {
  if (merchantId) {
    return { key: merchantId, displayName: (merchantName ?? name).trim() };
  }
  const normalized = normalizeMerchant(merchantName, name);
  if (!normalized) return null;
  return { key: normalized.canonicalKey, displayName: normalized.displayName };
}

/**
 * Detect recurring merchants from transaction history (≥3 charges, all cadences).
 * Series keyed by dim_merchant id or normalized canonical key.
 */
export async function detectRecurringFromTransactions(
  userIds: string[],
): Promise<DetectedRecurringItem[]> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select({
      merchantId: transactions.merchantId,
      merchant: transactions.merchantName,
      merchantDisplay: dimMerchant.displayName,
      name: transactions.name,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
    })
    .from(transactions)
    .leftJoin(dimMerchant, eq(transactions.merchantId, dimMerchant.id))
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
      ),
    );

  const groups = new Map<
    string,
    { displayName: string; charges: Array<{ date: string; amount: number; category: string }> }
  >();

  for (const r of rows) {
    const resolved = merchantGroupKey(
      r.merchantId,
      r.merchantDisplay ?? r.merchant,
      r.name,
    );
    if (!resolved) continue;

    const entry = groups.get(resolved.key) ?? {
      displayName: resolved.displayName,
      charges: [],
    };
    entry.charges.push({
      date: r.date,
      amount: Math.abs(Number.parseFloat(r.amount)),
      category: r.category,
    });
    groups.set(resolved.key, entry);
  }

  const candidates = buildRecurringSeries(groups);

  const zombieKeys = new Set<string>();
  for (const candidate of candidates) {
    const last = candidate.charges[candidate.charges.length - 1]!;
    const lifecycle = applyRecurringLifecycleFields({
      lastChargeDate: last.date,
      cadence: candidate.cadence,
      priceChanged: false,
    });
    if (lifecycle.status === "lapsed") {
      zombieKeys.add(candidate.merchantKey);
    }
  }

  const duplicateMap = markDuplicateFlags(candidates, zombieKeys);
  const detected: DetectedRecurringItem[] = [];

  for (const candidate of candidates) {
    const charges = candidate.charges;
    const last = charges[charges.length - 1]!;
    const creep = detectPriceCreep(charges, candidate.cadence);
    const prev =
      creep.priceChanged && charges.length >= 2
        ? charges[charges.length - 2]!
        : null;
    const lifecycle = applyRecurringLifecycleFields({
      lastChargeDate: last.date,
      cadence: candidate.cadence,
      priceChanged: creep.priceChanged,
    });

    const isZombie = lifecycle.status === "lapsed";
    const freeTrialJump = detectFreeTrialJump(charges);
    const flags = buildRecurringFlags({
      charges,
      cadence: candidate.cadence,
      priceChanged: creep.priceChanged,
      priceCreepPct: creep.priceCreepPct,
      priceConfidence: creep.confidence,
      isZombie,
      isDuplicate: duplicateMap.get(candidate.merchantKey) ?? false,
      freeTrialJump,
    });

    const category = candidate.category;
    const meta = categoryMeta(category);

    detected.push({
      merchantName: candidate.displayName,
      merchantKey: candidate.merchantKey,
      category,
      kind: SUBSCRIPTION_CATEGORIES.has(category) ? "subscription" : "bill",
      amount: formatMoneyAmount(candidate.medAmount),
      cadence: candidate.cadence,
      nextChargeDate: lifecycle.nextChargeDate,
      lastChargeDate: last.date,
      previousAmount: prev ? formatMoneyAmount(prev.amount) : null,
      priceChanged: creep.priceChanged,
      status: lifecycle.status,
      brandColor: meta.color,
      flags,
    });
  }

  return detected.sort(
    (a, b) => Number.parseFloat(b.amount) - Number.parseFloat(a.amount),
  );
}

export { daysBetween } from "./recurring-lifecycle.js";
