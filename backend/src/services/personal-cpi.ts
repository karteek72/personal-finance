import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { dimCategory, dimMerchant, transactions } from "../db/schema.js";
import { roundDecimal } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { detectRecurringFromTransactions } from "./detect-recurring.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

/** External reference CPI-U annual rate (BLS); not user-measured. */
export const NATIONAL_CPI_EXTERNAL = {
  rate: 3.2,
  source: "BLS CPI-U (external reference)",
  asOf: "2025-12",
} as const;

export interface PersonalCpiBasketItem {
  id: string;
  label: string;
  category: string;
  priceBase: number;
  priceNow: number;
  weight: number;
  source: "recurring" | "fixed_bill";
}

export interface PersonalCpiResult {
  /** Laspeyres index change as percent (e.g. 4.2 = 4.2% YoY-style). */
  personalRate: number;
  basket: PersonalCpiBasketItem[];
  confidence: number;
  caveats: string[];
  basePeriod: string;
  currentPeriod: string;
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

async function fixedBillMerchants(
  userIds: string[],
  accountIds: string[],
): Promise<Array<{ merchantKey: string; label: string; category: string }>> {
  const db = getDb();
  const eligible = await db
    .select({ category: dimCategory.category })
    .from(dimCategory)
    .where(eq(dimCategory.cpiWeightEligible, true));

  const categories = eligible.map((r) => r.category);
  if (categories.length === 0) return [];

  const since = monthsAgo(12);
  const rows = await db
    .select({
      merchantKey: sql<string>`coalesce(${dimMerchant.canonicalKey}, lower(trim(coalesce(${transactions.merchantName}, ${transactions.name}))))`,
      label: sql<string>`coalesce(${dimMerchant.displayName}, ${transactions.merchantName}, ${transactions.name})`,
      category: transactions.category,
    })
    .from(transactions)
    .leftJoin(dimMerchant, eq(transactions.merchantId, dimMerchant.id))
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        inArray(transactions.category, categories),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        gte(transactions.date, since),
      ),
    )
    .groupBy(
      sql`coalesce(${dimMerchant.canonicalKey}, lower(trim(coalesce(${transactions.merchantName}, ${transactions.name}))))`,
      sql`coalesce(${dimMerchant.displayName}, ${transactions.merchantName}, ${transactions.name})`,
      transactions.category,
    );

  return rows
    .filter((r) => r.merchantKey && r.merchantKey.length > 0)
    .map((r) => ({
      merchantKey: r.merchantKey,
      label: r.label,
      category: r.category,
    }));
}

async function merchantChargeAmounts(
  userIds: string[],
  accountIds: string[],
  merchantKey: string,
  nearDate: string,
  windowDays: number,
): Promise<number | null> {
  const db = getDb();
  const start = new Date(`${nearDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - windowDays);
  const end = new Date(`${nearDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + windowDays);

  const rows = await db
    .select({
      amount: sql<string>`coalesce(avg(${transactions.amount}::numeric), 0)`,
    })
    .from(transactions)
    .leftJoin(dimMerchant, eq(transactions.merchantId, dimMerchant.id))
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.transactionType, "expense"),
        sql`coalesce(${dimMerchant.canonicalKey}, lower(trim(coalesce(${transactions.merchantName}, ${transactions.name})))) = ${merchantKey}`,
        sql`${transactions.date} >= ${start.toISOString().slice(0, 10)}`,
        sql`${transactions.date} <= ${end.toISOString().slice(0, 10)}`,
      ),
    );

  const avg = Number.parseFloat(rows[0]?.amount ?? "0");
  return avg > 0 ? avg : null;
}

/**
 * Personal CPI (Laspeyres): Σ(price_now·qty_base) / Σ(price_base·qty_base) − 1
 * over recurring merchants + CPI-eligible fixed bills.
 */
export async function computePersonalCpi(userIds: string[]): Promise<PersonalCpiResult> {
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(userIds);
  const caveats: string[] = [];
  const basePeriod = monthsAgo(12).slice(0, 7);
  const currentPeriod = new Date().toISOString().slice(0, 7);

  if (!hasActiveAccounts) {
    return {
      personalRate: 0,
      basket: [],
      confidence: 0,
      caveats: ["No active accounts"],
      basePeriod,
      currentPeriod,
    };
  }

  const recurring = await detectRecurringFromTransactions(userIds);
  const fixedBills = await fixedBillMerchants(userIds, accountIds);

  const basketKeys = new Set<string>();
  const basketItems: PersonalCpiBasketItem[] = [];

  for (const item of recurring.filter((r) => r.status === "active")) {
    const key = item.merchantKey.toLowerCase();
    if (basketKeys.has(key)) continue;
    basketKeys.add(key);

    const priceNow = Number.parseFloat(item.amount);
    let priceBase = item.previousAmount
      ? Number.parseFloat(item.previousAmount)
      : priceNow;

    if (item.priceChanged && priceBase > 0) {
      // use detected prior amount
    } else {
      const historical = await merchantChargeAmounts(
        userIds,
        accountIds,
        key,
        monthsAgo(12),
        45,
      );
      if (historical) priceBase = historical;
    }

    if (priceBase <= 0 || priceNow <= 0) continue;

    basketItems.push({
      id: key,
      label: item.merchantName,
      category: item.category,
      priceBase,
      priceNow,
      weight: 1,
      source: "recurring",
    });
  }

  for (const bill of fixedBills.slice(0, 20)) {
    if (basketKeys.has(bill.merchantKey)) continue;
    basketKeys.add(bill.merchantKey);

    const priceNow = await merchantChargeAmounts(
      userIds,
      accountIds,
      bill.merchantKey,
      new Date().toISOString().slice(0, 10),
      30,
    );
    const priceBase = await merchantChargeAmounts(
      userIds,
      accountIds,
      bill.merchantKey,
      monthsAgo(12),
      45,
    );

    if (!priceNow || !priceBase) continue;

    basketItems.push({
      id: bill.merchantKey,
      label: bill.label,
      category: bill.category,
      priceBase,
      priceNow,
      weight: 1,
      source: "fixed_bill",
    });
  }

  if (basketItems.length < 3) {
    caveats.push(
      "Fewer than 3 repeat-purchase items in basket; personal CPI may be unreliable",
    );
  }
  caveats.push("Shrinkflation not detectable without line-item quantities");

  let numerator = 0;
  let denominator = 0;
  for (const item of basketItems) {
    numerator += item.priceNow * item.weight;
    denominator += item.priceBase * item.weight;
  }

  const personalRate =
    denominator > 0
      ? roundDecimal((numerator / denominator - 1) * 100)
      : 0;

  const confidence = Math.min(
    1,
    roundDecimal(Math.min(basketItems.length / 8, 1) * (denominator > 0 ? 0.9 : 0.3), 2),
  );

  return {
    personalRate,
    basket: basketItems,
    confidence,
    caveats,
    basePeriod,
    currentPeriod,
  };
}

/** Deflate a nominal amount by personal CPI (rate as percent). */
export function nominalToReal(nominal: number, personalCpiPercent: number): number {
  if (personalCpiPercent <= -100) return nominal;
  return nominal / (1 + personalCpiPercent / 100);
}
