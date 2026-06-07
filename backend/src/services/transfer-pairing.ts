import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  accounts,
  investmentTransactions,
  transactions,
  transferLinks,
} from "../db/schema.js";
import { roundDecimal } from "../lib/money.js";
import { createLogger } from "../lib/logger.js";
import {
  drizzleActiveTransactionWhere,
  resolveActiveAccountScope,
} from "./active-account-scope.js";
import { resolveHouseholdContext } from "./household-access.js";
import {
  BANK_TRANSFER_SUBCATEGORY,
  CREDIT_CARD_PAYMENT_SUBCATEGORY,
  INTERNAL_TRANSFER_CATEGORY,
  looksLikeTransfer,
  matchesCreditCardPaymentText,
} from "./transfer-classification.js";

const log = createLogger("transfer-pairing");

const AMOUNT_TOLERANCE_ABS = 1;
const AMOUNT_TOLERANCE_PCT = 0.01;
const DATE_TOLERANCE_DAYS = 4;
const SELF_TRANSFER_DATE_TOLERANCE_DAYS = 2;
/** Minimum match confidence before reclassifying both banking legs. */
export const RECONCILE_CONFIDENCE_THRESHOLD = 0.6;

export type TransferLinkKind = "bank_bank" | "bank_brokerage" | "cc_payment";

interface TxCandidate {
  id: string;
  userId: string;
  accountId: string;
  accountType: string;
  date: string;
  amount: number;
  signedAmount: number;
  transactionType: string;
  isTransfer: boolean;
  category: string;
  subCategory: string | null;
  name: string;
  merchantName: string | null;
}

interface InvestCandidate {
  id: string;
  userId: string;
  accountId: string;
  date: string;
  amount: number;
  type: string;
}

function daysApart(a: string, b: string): number {
  return Math.abs(
    Math.round(
      (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
}

export function amountsMatch(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const base = Math.max(a, b, 1);
  return diff <= AMOUNT_TOLERANCE_ABS || diff / base <= AMOUNT_TOLERANCE_PCT;
}

export function datesMatch(a: string, b: string): boolean {
  return daysApart(a, b) <= DATE_TOLERANCE_DAYS;
}

export function selfTransferDatesMatch(a: string, b: string): boolean {
  return daysApart(a, b) <= SELF_TRANSFER_DATE_TOLERANCE_DAYS;
}

export interface TransferReconciliationTarget {
  category: typeof INTERNAL_TRANSFER_CATEGORY;
  subCategory: string;
  transactionType: "transfer";
  isTransfer: true;
}

/** Category/subcategory for a high-confidence linked pair. */
export function reconciliationTargetForLink(
  linkKind: TransferLinkKind,
): TransferReconciliationTarget {
  switch (linkKind) {
    case "cc_payment":
      return {
        category: INTERNAL_TRANSFER_CATEGORY,
        subCategory: CREDIT_CARD_PAYMENT_SUBCATEGORY,
        transactionType: "transfer",
        isTransfer: true,
      };
    case "bank_bank":
    case "bank_brokerage":
      return {
        category: INTERNAL_TRANSFER_CATEGORY,
        subCategory: BANK_TRANSFER_SUBCATEGORY,
        transactionType: "transfer",
        isTransfer: true,
      };
  }
}

export function shouldReconcileTransaction(
  current: {
    isTransfer: boolean;
    transactionType: string;
    category: string;
    subCategory: string | null;
  },
  target: TransferReconciliationTarget,
): boolean {
  return !(
    current.isTransfer &&
    current.transactionType === "transfer" &&
    current.category === target.category &&
    current.subCategory === target.subCategory
  );
}

export function meetsReconcileConfidence(confidence: string | number): boolean {
  return Number.parseFloat(String(confidence)) >= RECONCILE_CONFIDENCE_THRESHOLD;
}

function matchConfidence(amountDiff: number, dateDiff: number): number {
  const amountScore = 1 - Math.min(amountDiff / 5, 1);
  const dateScore = 1 - Math.min(dateDiff / DATE_TOLERANCE_DAYS, 1);
  return roundDecimal(Math.max(0.5, amountScore * 0.65 + dateScore * 0.35), 3);
}

function isCcPayment(tx: TxCandidate): boolean {
  return (
    tx.isTransfer &&
    (tx.subCategory === CREDIT_CARD_PAYMENT_SUBCATEGORY ||
      tx.category === INTERNAL_TRANSFER_CATEGORY ||
      matchesCreditCardPaymentText(tx.name, tx.merchantName))
  );
}

function isOutflow(tx: TxCandidate): boolean {
  if (tx.transactionType === "expense") return true;
  if (tx.transactionType === "transfer" && tx.isTransfer) return true;
  return false;
}

function isInflow(tx: TxCandidate): boolean {
  if (tx.transactionType === "income") return true;
  if (tx.transactionType === "transfer" && tx.isTransfer) return true;
  return false;
}

/** Idempotent transfer pairing pass — run after each sync. */
export async function refreshTransferLinks(userId: string): Promise<number> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  if (!hasActiveAccounts) return 0;

  const db = getDb();
  await db
    .delete(transferLinks)
    .where(inArray(transferLinks.userId, ctx.userIds));

  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 2);
  const sinceDate = since.toISOString().slice(0, 10);

  const txRows = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      accountId: transactions.accountId,
      accountType: accounts.type,
      date: transactions.date,
      amount: transactions.amount,
      signedAmount: transactions.signedAmount,
      transactionType: transactions.transactionType,
      isTransfer: transactions.isTransfer,
      category: transactions.category,
      subCategory: transactions.subCategory,
      name: transactions.name,
      merchantName: transactions.merchantName,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        drizzleActiveTransactionWhere(ctx.userIds, accountIds),
        eq(transactions.pending, false),
        gte(transactions.date, sinceDate),
      ),
    );

  const investRows = await db
    .select({
      id: investmentTransactions.id,
      userId: investmentTransactions.userId,
      accountId: investmentTransactions.accountId,
      date: investmentTransactions.date,
      amount: investmentTransactions.amount,
      type: investmentTransactions.type,
    })
    .from(investmentTransactions)
    .where(
      and(
        inArray(investmentTransactions.userId, ctx.userIds),
        inArray(investmentTransactions.accountId, accountIds),
        gte(investmentTransactions.date, sinceDate),
        sql`${investmentTransactions.type} in ('contribution', 'buy')`,
      ),
    );

  const candidates: TxCandidate[] = txRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    accountType: row.accountType,
    date: row.date,
    amount: Math.abs(Number.parseFloat(row.amount)),
    signedAmount: Number.parseFloat(row.signedAmount ?? "0"),
    transactionType: row.transactionType,
    isTransfer: row.isTransfer,
    category: row.category,
    subCategory: row.subCategory,
    name: row.name,
    merchantName: row.merchantName,
  }));

  const investCandidates: InvestCandidate[] = investRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    accountId: row.accountId,
    date: row.date,
    amount: Math.abs(Number.parseFloat(row.amount)),
    type: row.type,
  }));

  const usedOutflows = new Set<string>();
  const usedInflows = new Set<string>();
  const usedInvestInflows = new Set<string>();
  const links: Array<{
    userId: string;
    outflowTxnId: string | null;
    inflowTxnId: string | null;
    inflowInvestmentTxnId: string | null;
    matchConfidence: string;
    linkKind: TransferLinkKind;
  }> = [];

  const outflows = candidates.filter(isOutflow);
  const inflows = candidates.filter(isInflow);

  for (const out of outflows) {
    if (usedOutflows.has(out.id)) continue;

    if (isCcPayment(out)) {
      const ccInflow = inflows.find(
        (inf) =>
          !usedInflows.has(inf.id) &&
          inf.accountType === "credit" &&
          inf.accountId !== out.accountId &&
          amountsMatch(out.amount, inf.amount) &&
          datesMatch(out.date, inf.date),
      );
      if (ccInflow) {
        links.push({
          userId: out.userId,
          outflowTxnId: out.id,
          inflowTxnId: ccInflow.id,
          inflowInvestmentTxnId: null,
          matchConfidence: String(
            matchConfidence(
              Math.abs(out.amount - ccInflow.amount),
              daysApart(out.date, ccInflow.date),
            ),
          ),
          linkKind: "cc_payment",
        });
        usedOutflows.add(out.id);
        usedInflows.add(ccInflow.id);
      }
      continue;
    }

    const bankInflow = inflows.find(
      (inf) =>
        !usedInflows.has(inf.id) &&
        inf.accountId !== out.accountId &&
        out.accountType === "depository" &&
        inf.accountType === "depository" &&
        amountsMatch(out.amount, inf.amount) &&
        datesMatch(out.date, inf.date),
    );
    if (bankInflow) {
      links.push({
        userId: out.userId,
        outflowTxnId: out.id,
        inflowTxnId: bankInflow.id,
        inflowInvestmentTxnId: null,
        matchConfidence: String(
          matchConfidence(
            Math.abs(out.amount - bankInflow.amount),
            daysApart(out.date, bankInflow.date),
          ),
        ),
        linkKind: "bank_bank",
      });
      usedOutflows.add(out.id);
      usedInflows.add(bankInflow.id);
      continue;
    }

    if (out.accountType === "depository") {
      const investInflow = investCandidates.find(
        (inf) =>
          !usedInvestInflows.has(inf.id) &&
          inf.accountId !== out.accountId &&
          amountsMatch(out.amount, inf.amount) &&
          datesMatch(out.date, inf.date),
      );
      if (investInflow) {
        links.push({
          userId: out.userId,
          outflowTxnId: out.id,
          inflowTxnId: null,
          inflowInvestmentTxnId: investInflow.id,
          matchConfidence: String(
            matchConfidence(
              Math.abs(out.amount - investInflow.amount),
              daysApart(out.date, investInflow.date),
            ),
          ),
          linkKind: "bank_brokerage",
        });
        usedOutflows.add(out.id);
        usedInvestInflows.add(investInflow.id);
      }
    }
  }

  if (links.length > 0) {
    await db.insert(transferLinks).values(links);
  }

  await reconcileLinkedTransferLegs(ctx.userIds);
  await classifyUnmatchedSelfTransfers(userId);

  log.info({ userId, links: links.length }, "refreshed transfer links");
  return links.length;
}

/** Idempotent: mark both banking legs of high-confidence links as internal transfers. */
export async function reconcileLinkedTransferLegs(
  userIds: string[],
): Promise<number> {
  const db = getDb();
  const linkRows = await db
    .select({
      outflowTxnId: transferLinks.outflowTxnId,
      inflowTxnId: transferLinks.inflowTxnId,
      matchConfidence: transferLinks.matchConfidence,
      linkKind: transferLinks.linkKind,
    })
    .from(transferLinks)
    .where(inArray(transferLinks.userId, userIds));

  let updated = 0;
  for (const link of linkRows) {
    if (!meetsReconcileConfidence(link.matchConfidence)) continue;

    const target = reconciliationTargetForLink(link.linkKind as TransferLinkKind);
    const txnIds = [link.outflowTxnId, link.inflowTxnId].filter(
      (id): id is string => id != null,
    );

    for (const txnId of txnIds) {
      const [row] = await db
        .select({
          id: transactions.id,
          isTransfer: transactions.isTransfer,
          transactionType: transactions.transactionType,
          category: transactions.category,
          subCategory: transactions.subCategory,
        })
        .from(transactions)
        .where(eq(transactions.id, txnId))
        .limit(1);

      if (!row || !shouldReconcileTransaction(row, target)) continue;

      await db
        .update(transactions)
        .set({
          category: target.category,
          subCategory: target.subCategory,
          transactionType: target.transactionType,
          isTransfer: target.isTransfer,
        })
        .where(eq(transactions.id, txnId));
      updated += 1;
    }
  }

  if (updated > 0) {
    log.info({ userIds, updated }, "reconciled linked transfer legs");
  }
  return updated;
}

interface SelfTransferCandidate {
  id: string;
  userId: string;
  accountId: string;
  accountType: string;
  date: string;
  amount: number;
  signedAmount: number;
  transactionType: string;
  isTransfer: boolean;
  category: string;
  subCategory: string | null;
  name: string;
  merchantName: string | null;
}

function isSignedOutflow(tx: SelfTransferCandidate): boolean {
  return tx.signedAmount < 0;
}

function isSignedInflow(tx: SelfTransferCandidate): boolean {
  return tx.signedAmount > 0;
}

/**
 * Conservative fallback for same-owner bank transfers the pairer missed
 * (e.g. non-Plaid sources with mismatched transaction types).
 */
export async function classifyUnmatchedSelfTransfers(
  userId: string,
): Promise<number> {
  const ctx = await resolveHouseholdContext(userId);
  const { accountIds, hasActiveAccounts } = await resolveActiveAccountScope(
    ctx.userIds,
  );
  if (!hasActiveAccounts) return 0;

  const db = getDb();
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 2);
  const sinceDate = since.toISOString().slice(0, 10);

  const linkedOutflowRows = await db
    .select({ outflowTxnId: transferLinks.outflowTxnId })
    .from(transferLinks)
    .where(inArray(transferLinks.userId, ctx.userIds));
  const linkedInflowRows = await db
    .select({ inflowTxnId: transferLinks.inflowTxnId })
    .from(transferLinks)
    .where(inArray(transferLinks.userId, ctx.userIds));

  const linkedIds = new Set<string>();
  for (const row of linkedOutflowRows) {
    if (row.outflowTxnId) linkedIds.add(row.outflowTxnId);
  }
  for (const row of linkedInflowRows) {
    if (row.inflowTxnId) linkedIds.add(row.inflowTxnId);
  }

  const txRows = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      accountId: transactions.accountId,
      accountType: accounts.type,
      date: transactions.date,
      amount: transactions.amount,
      signedAmount: transactions.signedAmount,
      transactionType: transactions.transactionType,
      isTransfer: transactions.isTransfer,
      category: transactions.category,
      subCategory: transactions.subCategory,
      name: transactions.name,
      merchantName: transactions.merchantName,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        drizzleActiveTransactionWhere(ctx.userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.isTransfer, false),
        gte(transactions.date, sinceDate),
        eq(accounts.type, "depository"),
      ),
    );

  const candidates: SelfTransferCandidate[] = txRows
    .filter((row) => !linkedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      accountId: row.accountId,
      accountType: row.accountType,
      date: row.date,
      amount: Math.abs(Number.parseFloat(row.amount)),
      signedAmount: Number.parseFloat(row.signedAmount ?? "0"),
      transactionType: row.transactionType,
      isTransfer: row.isTransfer,
      category: row.category,
      subCategory: row.subCategory,
      name: row.name,
      merchantName: row.merchantName,
    }));

  const outflows = candidates.filter(isSignedOutflow);
  const inflows = candidates.filter(isSignedInflow);
  const used = new Set<string>();
  const target = reconciliationTargetForLink("bank_bank");
  let updated = 0;

  for (const out of outflows) {
    if (used.has(out.id)) continue;

    const match = inflows.find(
      (inf) =>
        !used.has(inf.id) &&
        inf.accountId !== out.accountId &&
        inf.userId === out.userId &&
        amountsMatch(out.amount, inf.amount) &&
        selfTransferDatesMatch(out.date, inf.date) &&
        (looksLikeTransfer(out) || looksLikeTransfer(inf)),
    );

    if (!match) continue;

    for (const leg of [out, match]) {
      if (!shouldReconcileTransaction(leg, target)) {
        used.add(leg.id);
        continue;
      }
      await db
        .update(transactions)
        .set({
          category: target.category,
          subCategory: target.subCategory,
          transactionType: target.transactionType,
          isTransfer: target.isTransfer,
        })
        .where(eq(transactions.id, leg.id));
      updated += 1;
      used.add(leg.id);
    }
  }

  if (updated > 0) {
    log.info({ userId, updated }, "classified unmatched self-transfers");
  }
  return updated;
}

export interface UnpairedTransferLikeSummary {
  count: number;
  amount: number;
}

/** Remaining transfer-looking outflows that are still unpaired after reconciliation. */
export async function unpairedTransferLikeOutflows(
  userIds: string[],
): Promise<UnpairedTransferLikeSummary> {
  const db = getDb();
  const { accountIds } = await resolveActiveAccountScope(userIds);
  if (accountIds.length === 0) return { count: 0, amount: 0 };

  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      name: transactions.name,
      merchantName: transactions.merchantName,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        eq(transactions.isTransfer, false),
        eq(transactions.transactionType, "expense"),
        sql`${transactions.signedAmount}::numeric < 0`,
      ),
    );

  const linkedOutflowRows = await db
    .select({ outflowTxnId: transferLinks.outflowTxnId })
    .from(transferLinks)
    .where(inArray(transferLinks.userId, userIds));
  const linkedOutflows = new Set(
    linkedOutflowRows
      .map((row) => row.outflowTxnId)
      .filter((id): id is string => id != null),
  );

  let count = 0;
  let amount = 0;
  for (const row of rows) {
    if (linkedOutflows.has(row.id)) continue;
    if (
      !looksLikeTransfer({
        name: row.name,
        merchantName: row.merchantName,
        category: row.category,
      })
    ) {
      continue;
    }
    count += 1;
    amount += Math.abs(Number.parseFloat(row.amount));
  }

  return { count, amount: roundDecimal(amount, 2) };
}

/** Sum paired brokerage contributions over a trailing window. */
export async function sumLinkedBrokerageContributions(
  userIds: string[],
  lookbackMonths = 12,
): Promise<number> {
  const db = getDb();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - lookbackMonths);
  const sinceDate = since.toISOString().slice(0, 10);

  const rows = await db
    .select({
      amount: transactions.amount,
      investAmount: investmentTransactions.amount,
    })
    .from(transferLinks)
    .leftJoin(transactions, eq(transferLinks.outflowTxnId, transactions.id))
    .leftJoin(
      investmentTransactions,
      eq(transferLinks.inflowInvestmentTxnId, investmentTransactions.id),
    )
    .where(
      and(
        inArray(transferLinks.userId, userIds),
        eq(transferLinks.linkKind, "bank_brokerage"),
        sql`coalesce(${transactions.date}, ${investmentTransactions.date}) >= ${sinceDate}`,
      ),
    );

  let total = 0;
  for (const row of rows) {
    const amt = row.amount ?? row.investAmount;
    if (amt) total += Math.abs(Number.parseFloat(amt));
  }
  return total;
}

/** Percent of transfer outflows that have a linked inflow leg. */
export async function transferPairCoverage(userIds: string[]): Promise<number> {
  const db = getDb();
  const { accountIds } = await resolveActiveAccountScope(userIds);
  if (accountIds.length === 0) return 1;

  const [outflowRow] = await db
    .select({
      total: sql<string>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        drizzleActiveTransactionWhere(userIds, accountIds),
        eq(transactions.pending, false),
        sql`(${transactions.isTransfer} = true OR ${transactions.transactionType} = 'transfer')`,
      ),
    );

  const outflowCount = Number.parseInt(outflowRow?.total ?? "0", 10);
  if (outflowCount === 0) return 1;

  const [linkedRow] = await db
    .select({
      total: sql<string>`count(distinct ${transferLinks.outflowTxnId})`,
    })
    .from(transferLinks)
    .where(inArray(transferLinks.userId, userIds));

  const linked = Number.parseInt(linkedRow?.total ?? "0", 10);
  return roundDecimal(linked / outflowCount, 2);
}
