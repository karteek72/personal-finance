import { formatMoneyAmount } from "../../lib/money.js";
import type { TellerTransaction } from "./client.js";

const TELLER_CATEGORY_MAP: Record<string, string> = {
  groceries: "Food & Groceries",
  dining: "Dining & Restaurants",
  transport: "Transportation",
  transportation: "Transportation",
  fuel: "Transportation",
  entertainment: "Entertainment",
  shopping: "Shopping",
  health: "Health & Wellness",
  income: "Income",
  investment: "Investments",
  loan: "Financial & Insurance",
  insurance: "Financial & Insurance",
  utilities: "Utilities & Bills",
  accommodation: "Travel & Vacation",
  education: "Education",
  software: "Subscriptions & Software",
  service: "Personal Care & Services",
};

function mapTellerCategory(raw: string | null | undefined): string {
  if (!raw) return "Uncategorized";
  return TELLER_CATEGORY_MAP[raw.toLowerCase()] ?? "Uncategorized";
}

export function mapTellerTransaction(
  txn: TellerTransaction,
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
  const raw = Number.parseFloat(txn.amount);
  const isTransfer =
    txn.type === "transfer" ||
    txn.description.toLowerCase().includes("transfer");

  let transactionType: "expense" | "income" | "transfer" = "expense";
  let amount: string;

  if (isTransfer) {
    transactionType = "transfer";
    amount = formatMoneyAmount(Math.abs(raw));
  } else if (accountType === "credit") {
    if (raw > 0) {
      transactionType = "expense";
      amount = formatMoneyAmount(raw);
    } else {
      transactionType = "income";
      amount = formatMoneyAmount(Math.abs(raw));
    }
  } else if (raw > 0) {
    transactionType = "expense";
    amount = formatMoneyAmount(raw);
  } else {
    transactionType = "income";
    amount = formatMoneyAmount(Math.abs(raw));
  }

  const merchantName =
    txn.details?.counterparty?.name?.trim() ||
    null;

  return {
    externalId: `teller:${txn.id}`,
    date: txn.date,
    name: txn.description.trim() || "Transaction",
    merchantName,
    amount,
    category: mapTellerCategory(txn.details?.category),
    transactionType,
    isTransfer,
    pending: txn.status === "pending",
  };
}
