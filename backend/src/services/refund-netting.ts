import { daysBetween } from "./recurring-lifecycle.js";
import { amountsMatch } from "./transfer-pairing.js";

export interface RefundCandidate {
  id: string;
  date: string;
  amount: number;
  merchantKey: string;
  category: string;
}

export interface RefundPair {
  debitId: string;
  creditId: string;
  amount: number;
}

export interface RefundNettingResult {
  nettedPairs: RefundPair[];
  nettedTotal: number;
  unmatchedCreditTotal: number;
}

const REFUND_WINDOW_DAYS = 45;
const REFUND_PATTERN = /refund|return|rebate|credit adjustment|chargeback/i;

/** Identify likely refund/reversal income credits. */
export function isLikelyRefundCredit(input: {
  transactionType: string;
  category: string;
  name: string;
  merchantName: string | null;
}): boolean {
  if (input.transactionType !== "income") return false;
  if (input.category === "Income") {
    return REFUND_PATTERN.test(`${input.name} ${input.merchantName ?? ""}`);
  }
  return true;
}

/** Pair refund credits to prior debits within window; unmatched credits stay as income. */
export function netRefundCredits(
  debits: RefundCandidate[],
  credits: RefundCandidate[],
  windowDays = REFUND_WINDOW_DAYS,
): RefundNettingResult {
  const sortedDebits = [...debits].sort((a, b) => a.date.localeCompare(b.date));
  const sortedCredits = [...credits].sort((a, b) => a.date.localeCompare(b.date));
  const usedDebits = new Set<string>();
  const nettedPairs: RefundPair[] = [];
  let nettedTotal = 0;
  let unmatchedCreditTotal = 0;

  for (const credit of sortedCredits) {
    let matched = false;
    for (const debit of sortedDebits) {
      if (usedDebits.has(debit.id)) continue;
      if (debit.date > credit.date) continue;
      if (daysBetween(debit.date, credit.date) > windowDays) continue;
      if (debit.merchantKey !== credit.merchantKey && debit.category !== credit.category) {
        continue;
      }
      if (!amountsMatch(debit.amount, credit.amount)) continue;

      const amount = Math.min(debit.amount, credit.amount);
      nettedPairs.push({ debitId: debit.id, creditId: credit.id, amount });
      nettedTotal += amount;
      usedDebits.add(debit.id);
      matched = true;
      break;
    }
    if (!matched) {
      unmatchedCreditTotal += credit.amount;
    }
  }

  return { nettedPairs, nettedTotal, unmatchedCreditTotal };
}

/** Reduce gross expense by matched refund pairs. */
export function netExpenseAfterRefunds(
  grossExpense: number,
  nettedRefundTotal: number,
): number {
  return Math.max(0, grossExpense - nettedRefundTotal);
}
