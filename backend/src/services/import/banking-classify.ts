const TRANSFER_PATTERNS = [
  /mobile payment.*thank you/i,
  /american express des:ach pmt/i,
  /online scheduled payment/i,
  /payment thank you/i,
  /autopay/i,
];

export function categorizeBankingTransaction(name: string): string {
  const n = name.toUpperCase();
  if (/CISCO SYSTEMS.*PAYROLL|PAYROLL|DIRECT DEPOSIT/.test(n)) return "Income";
  if (/ZELLE|FID BKG|MONEYLINE/.test(n)) return "Transfers (internal)";
  if (/AMERICAN EXPRESS.*ACH|ONLINE SCHEDULEMENT PAYMENT|VEHICLE LOAN/.test(n))
    return "Transfers (internal)";
  if (/COSTCO|WHOLE FOODS|SPROUTS|GROCERY/.test(n)) return "Food & Groceries";
  if (/TST |RESTAURANT|DOMINO|VELVET TACO/.test(n)) return "Dining & Restaurants";
  if (/CURSOR|APPLE\.COM|NETFLIX|SUBSCRIPTION/.test(n))
    return "Subscriptions & Software";
  if (/COSERV|ALLENWATER|AT&T \*PAYMENT|UTILITY|ELECTRIC/.test(n))
    return "Utilities & Bills";
  if (/FEDEX|NTTA|TOLL|GAS|RACETRAC/.test(n)) return "Transportation";
  if (/INTEREST CHARGE|LATE FEE|FEE/.test(n)) return "Financial & Insurance";
  return "Uncategorized";
}

export function classifyBankingType(
  name: string,
  accountType: "credit" | "depository",
  signedAmount: number,
): { transactionType: "expense" | "income" | "transfer"; isTransfer: boolean } {
  if (TRANSFER_PATTERNS.some((p) => p.test(name))) {
    return { transactionType: "transfer", isTransfer: true };
  }
  if (accountType === "credit") {
    if (signedAmount > 0 && /PAYMENT|CREDIT|THANK YOU/.test(name.toUpperCase())) {
      return { transactionType: "transfer", isTransfer: true };
    }
    return { transactionType: "expense", isTransfer: false };
  }
  if (signedAmount < 0) return { transactionType: "income", isTransfer: false };
  return { transactionType: "expense", isTransfer: false };
}
