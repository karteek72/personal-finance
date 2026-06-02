import type { Transaction as PlaidTransaction } from "plaid";

const PFC_MAP: Record<string, string> = {
  INCOME: "Income",
  INCOME_DIVIDENDS: "Income",
  INCOME_INTEREST_EARNED: "Income",
  INCOME_RETIREMENT_PENSION: "Income",
  INCOME_TAX_REFUND: "Income",
  INCOME_UNEMPLOYMENT: "Income",
  INCOME_WAGES: "Income",
  TRANSFER_IN: "Transfers (internal)",
  TRANSFER_OUT: "Transfers (internal)",
  LOAN_PAYMENTS: "Transfers (internal)",
  FOOD_AND_DRINK: "Dining & Restaurants",
  FOOD_AND_DRINK_GROCERIES: "Food & Groceries",
  FOOD_AND_DRINK_RESTAURANT: "Dining & Restaurants",
  TRANSPORTATION: "Transport & Gas",
  TRANSPORTATION_GAS: "Transport & Gas",
  TRANSPORTATION_TOLLS: "Transport & Gas",
  ENTERTAINMENT: "Entertainment",
  GENERAL_MERCHANDISE: "Shopping & Retail",
  RENT_AND_UTILITIES: "Utilities & Bills",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Utilities & Bills",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "Utilities & Bills",
  RENT_AND_UTILITIES_RENT: "Home & Rent",
  RENT_AND_UTILITIES_TELEPHONE: "Utilities & Bills",
  RENT_AND_UTILITIES_WATER: "Utilities & Bills",
  MEDICAL: "Health & Medical",
  TRAVEL: "Travel & Hotels",
  PERSONAL_CARE: "Personal Care",
  GENERAL_SERVICES: "Financial",
  BANK_FEES: "Financial",
  GOVERNMENT_AND_NON_PROFIT: "Financial",
};

const TRANSFER_PATTERNS = [
  /payment thank you/i,
  /online scheduled payment/i,
  /autopay/i,
  /transfer/i,
  /zelle/i,
];

export function mapPlaidCategory(txn: PlaidTransaction): string {
  const detailed = txn.personal_finance_category?.detailed;
  if (detailed && PFC_MAP[detailed]) {
    return PFC_MAP[detailed]!;
  }
  const primary = txn.personal_finance_category?.primary;
  if (primary && PFC_MAP[primary]) {
    return PFC_MAP[primary]!;
  }
  const legacy = txn.category?.[0];
  if (legacy) {
    return legacy;
  }
  return "Uncategorized";
}

export function mapPlaidTransaction(
  txn: PlaidTransaction,
  accountType: "depository" | "credit",
): {
  externalId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  category: string;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
} {
  const name = txn.merchant_name ?? txn.name;
  const raw = txn.amount;
  const isTransferByName = TRANSFER_PATTERNS.some((pattern) =>
    pattern.test(name),
  );

  let transactionType: "expense" | "income" | "transfer";
  let isTransfer = isTransferByName;
  let amount: string;

  if (accountType === "credit") {
    if (raw < 0 || isTransferByName) {
      transactionType = "transfer";
      isTransfer = true;
      amount = Math.abs(raw).toFixed(2);
    } else {
      transactionType = "expense";
      amount = Math.abs(raw).toFixed(2);
    }
  } else if (raw < 0) {
    transactionType = isTransferByName ? "transfer" : "income";
    isTransfer = isTransferByName;
    amount = isTransfer ? Math.abs(raw).toFixed(2) : (-Math.abs(raw)).toFixed(2);
  } else {
    transactionType = isTransferByName ? "transfer" : "expense";
    isTransfer = isTransferByName;
    amount = Math.abs(raw).toFixed(2);
  }

  const category = isTransfer
    ? "Transfers (internal)"
    : mapPlaidCategory(txn);

  return {
    externalId: `plaid-${txn.transaction_id}`,
    date: txn.date,
    name: txn.name,
    merchantName: txn.merchant_name ?? null,
    amount,
    category,
    transactionType,
    isTransfer,
    pending: txn.pending ?? false,
  };
}
