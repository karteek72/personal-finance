import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { accounts, creditCardLiabilities } from "../db/schema.js";
import { formatMoneyAmount } from "../lib/money.js";
import type { StoredApr } from "./plaid/sync-liabilities.js";

export interface CreditCardApr {
  aprType: string;
  aprPercentage: string;
  balanceSubjectToApr: string | null;
  interestChargeAmount: string | null;
}

export interface AccountCreditLiability {
  lastStatementBalance: string | null;
  lastStatementIssueDate: string | null;
  minimumPaymentAmount: string | null;
  nextPaymentDueDate: string | null;
  lastPaymentAmount: string | null;
  lastPaymentDate: string | null;
  isOverdue: boolean | null;
  aprs: CreditCardApr[];
  purchaseApr: string | null;
  estimatedMonthlyInterest: string | null;
  statementVsCurrentDelta: string | null;
  daysUntilDue: number | null;
  syncedAt: string | null;
}

export interface CreditCardDebtRow {
  accountId: string;
  name: string;
  mask: string | null;
  institutionName: string;
  balanceCurrent: string;
  liability: AccountCreditLiability | null;
}

export interface CreditDebtSummary {
  totalCurrentBalance: string;
  totalStatementBalance: string;
  totalMinimumDue: string;
  totalEstimatedMonthlyInterest: string;
  overdueCount: number;
  cards: CreditCardDebtRow[];
}

function parseAprs(value: unknown): CreditCardApr[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const row = entry as StoredApr;
    if (typeof row.aprType !== "string" || typeof row.aprPercentage !== "string") {
      return [];
    }
    return [
      {
        aprType: row.aprType,
        aprPercentage: row.aprPercentage,
        balanceSubjectToApr: row.balanceSubjectToApr ?? null,
        interestChargeAmount: row.interestChargeAmount ?? null,
      },
    ];
  });
}

function pickPurchaseApr(aprs: CreditCardApr[]): string | null {
  const purchase =
    aprs.find((apr) => apr.aprType === "purchase_apr") ??
    aprs.find((apr) => apr.aprType.includes("purchase")) ??
    aprs[0];
  return purchase?.aprPercentage ?? null;
}

function estimateMonthlyInterest(
  balance: string | null,
  purchaseApr: string | null,
): string | null {
  if (!balance || !purchaseApr) {
    return null;
  }
  const balanceNum = Number.parseFloat(balance);
  const aprNum = Number.parseFloat(purchaseApr);
  if (Number.isNaN(balanceNum) || Number.isNaN(aprNum) || balanceNum <= 0) {
    return null;
  }
  return formatMoneyAmount((balanceNum * (aprNum / 100)) / 12);
}

function daysUntil(date: string | null): number | null {
  if (!date) {
    return null;
  }
  const due = new Date(`${date}T00:00:00`);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function mapLiabilityRow(
  row: typeof creditCardLiabilities.$inferSelect,
  balanceCurrent: string,
): AccountCreditLiability {
  const aprs = parseAprs(row.aprs);
  const purchaseApr = pickPurchaseApr(aprs);
  const statementBalance = row.lastStatementBalance ?? null;
  const balanceNum = Number.parseFloat(balanceCurrent);
  const statementNum = statementBalance
    ? Number.parseFloat(statementBalance)
    : null;
  const delta =
    statementNum != null && !Number.isNaN(balanceNum)
      ? formatMoneyAmount(balanceNum - statementNum)
      : null;

  return {
    lastStatementBalance: statementBalance,
    lastStatementIssueDate: row.lastStatementIssueDate,
    minimumPaymentAmount: row.minimumPaymentAmount ?? null,
    nextPaymentDueDate: row.nextPaymentDueDate,
    lastPaymentAmount: row.lastPaymentAmount ?? null,
    lastPaymentDate: row.lastPaymentDate,
    isOverdue: row.isOverdue,
    aprs,
    purchaseApr,
    estimatedMonthlyInterest: estimateMonthlyInterest(
      balanceCurrent,
      purchaseApr,
    ),
    statementVsCurrentDelta: delta,
    daysUntilDue: daysUntil(row.nextPaymentDueDate),
    syncedAt: row.syncedAt?.toISOString() ?? null,
  };
}

export async function getLiabilityMapForAccounts(
  accountIds: string[],
): Promise<Map<string, AccountCreditLiability>> {
  if (accountIds.length === 0) {
    return new Map();
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(creditCardLiabilities)
    .where(inArray(creditCardLiabilities.accountId, accountIds));

  const accountRows = await db
    .select({
      id: accounts.id,
      balanceCurrent: accounts.balanceCurrent,
    })
    .from(accounts)
    .where(inArray(accounts.id, accountIds));

  const balanceByAccount = new Map(
    accountRows.map((row) => [row.id, row.balanceCurrent ?? "0.00"]),
  );

  return new Map(
    rows.map((row) => [
      row.accountId,
      mapLiabilityRow(row, balanceByAccount.get(row.accountId) ?? "0.00"),
    ]),
  );
}

export async function getCreditDebtSummary(
  userId: string,
): Promise<CreditDebtSummary> {
  const db = getDb();
  const creditAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isActive, true),
        eq(accounts.type, "credit"),
      ),
    )
    .orderBy(accounts.name);

  const liabilityMap = await getLiabilityMapForAccounts(
    creditAccounts.map((row) => row.id),
  );

  let totalCurrent = 0;
  let totalStatement = 0;
  let totalMinimum = 0;
  let totalInterest = 0;
  let overdueCount = 0;

  const cards: CreditCardDebtRow[] = creditAccounts.map((account) => {
    const balanceCurrent = account.balanceCurrent ?? "0.00";
    const liability = liabilityMap.get(account.id) ?? null;

    totalCurrent += Number.parseFloat(balanceCurrent);
    if (liability?.lastStatementBalance) {
      totalStatement += Number.parseFloat(liability.lastStatementBalance);
    }
    if (liability?.minimumPaymentAmount) {
      totalMinimum += Number.parseFloat(liability.minimumPaymentAmount);
    }
    if (liability?.estimatedMonthlyInterest) {
      totalInterest += Number.parseFloat(liability.estimatedMonthlyInterest);
    }
    if (liability?.isOverdue) {
      overdueCount += 1;
    }

    return {
      accountId: account.id,
      name: account.name,
      mask: account.mask,
      institutionName: account.institutionName,
      balanceCurrent,
      liability,
    };
  });

  cards.sort((a, b) => {
    const dueA = a.liability?.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
    const dueB = b.liability?.daysUntilDue ?? Number.MAX_SAFE_INTEGER;
    if (dueA !== dueB) {
      return dueA - dueB;
    }
    return Number.parseFloat(b.balanceCurrent) - Number.parseFloat(a.balanceCurrent);
  });

  return {
    totalCurrentBalance: formatMoneyAmount(totalCurrent),
    totalStatementBalance: formatMoneyAmount(totalStatement),
    totalMinimumDue: formatMoneyAmount(totalMinimum),
    totalEstimatedMonthlyInterest: formatMoneyAmount(totalInterest),
    overdueCount,
    cards,
  };
}

export function liabilityCoverageLabel(
  cardsWithData: number,
  totalCards: number,
): string {
  if (totalCards === 0) {
    return "No credit cards linked";
  }
  if (cardsWithData === 0) {
    return "Enable Plaid Liabilities and re-link cards for statement details";
  }
  return `${cardsWithData} of ${totalCards} cards reporting liability data`;
}
