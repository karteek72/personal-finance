import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "../db/client.js";
import { transactions } from "../db/schema.js";
import { formatMoneyAmount, roundDecimal } from "../lib/money.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { INTERNAL_TRANSFER_CATEGORY } from "./transfer-classification.js";

export interface DetectedFee {
  id: string;
  label: string;
  source: string;
  count: number;
  total: string;
  fixable: boolean;
}

interface FeeRule {
  id: string;
  label: string;
  source: string;
  fixable: boolean;
  pattern: RegExp;
}

const FEE_RULES: FeeRule[] = [
  {
    id: "atm",
    label: "ATM fees",
    source: "Checking",
    fixable: true,
    pattern: /atm|out-of-network atm|withdrawal fee|non-network atm/i,
  },
  {
    id: "overdraft",
    label: "Overdraft fees",
    source: "Checking",
    fixable: true,
    pattern: /overdraft|insufficient funds|\bnsf\b|od fee/i,
  },
  {
    id: "maint",
    label: "Account maintenance fees",
    source: "Checking",
    fixable: true,
    pattern: /maintenance fee|monthly fee|service charge|account fee|minimum balance fee/i,
  },
  {
    id: "late",
    label: "Late payment fees",
    source: "Credit cards",
    fixable: true,
    pattern: /late fee|late payment|past due fee/i,
  },
  {
    id: "fx",
    label: "Foreign transaction fees",
    source: "Credit cards",
    fixable: true,
    pattern: /foreign transaction|fx fee|intl fee|foreign exchange|international fee/i,
  },
];

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Hidden fee rows for recurring.leaks.fees — last 12 months. */
export async function detectHiddenFees(
  userIds: string[],
): Promise<DetectedFee[]> {
  const { accountIds, hasActiveAccounts } =
    await resolveActiveAccountScope(userIds);
  if (!hasActiveAccounts) return [];

  const since = monthsAgo(12);
  const db = getDb();
  const rows = await db
    .select({
      subCategory: transactions.subCategory,
      merchantName: transactions.merchantName,
      name: transactions.name,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.transactionType, "expense"),
        eq(transactions.isTransfer, false),
        eq(transactions.pending, false),
        sql`${transactions.category} != ${INTERNAL_TRANSFER_CATEGORY}`,
        gte(transactions.date, since),
        sql`${transactions.subCategory} IN ('Bank Fees & Interest', 'Bank Fees')`,
      ),
    );

  const totals = new Map<string, { count: number; total: number }>();
  for (const rule of FEE_RULES) {
    totals.set(rule.id, { count: 0, total: 0 });
  }

  for (const row of rows) {
    const spend = Math.abs(Number.parseFloat(row.amount));
    if (!Number.isFinite(spend) || spend <= 0) continue;
    const text = `${row.merchantName ?? ""} ${row.name ?? ""}`;

    for (const rule of FEE_RULES) {
      if (!rule.pattern.test(text)) continue;
      const bucket = totals.get(rule.id)!;
      bucket.count += 1;
      bucket.total = roundDecimal(bucket.total + spend);
      break;
    }
  }

  return FEE_RULES.map((rule) => {
    const bucket = totals.get(rule.id)!;
    return {
      id: rule.id,
      label: rule.label,
      source: rule.source,
      count: bucket.count,
      total: formatMoneyAmount(bucket.total),
      fixable: rule.fixable,
    };
  }).filter((f) => f.count > 0);
}
