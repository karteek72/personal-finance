import type { CategoryRule } from "../category-rules.js";
import { classifyBankingTransaction } from "../classify-banking-transaction.js";
import type { ParsedBankingTransaction, ParsedStatement } from "./types.js";

export function enrichBankingTransactionClassification(
  txn: ParsedBankingTransaction,
  categoryRules: Map<string, CategoryRule>,
): ParsedBankingTransaction {
  const classified = classifyBankingTransaction({
    categoryHint: txn.category,
    name: txn.name,
    merchantName: txn.merchantName,
    categoryRules,
    transactionType: txn.transactionType,
    isTransfer: txn.isTransfer,
  });

  return {
    ...txn,
    category: classified.category,
    subCategory: classified.subCategory,
    transactionType: classified.transactionType,
    isTransfer: classified.isTransfer,
  };
}

export function enrichStatementsWithClassification(
  statements: ParsedStatement[],
  categoryRules: Map<string, CategoryRule>,
): ParsedStatement[] {
  return statements.map((statement) => ({
    ...statement,
    bankingTransactions: statement.bankingTransactions.map((txn) =>
      enrichBankingTransactionClassification(txn, categoryRules),
    ),
  }));
}
