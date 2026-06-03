/** Category labels — keep aligned with docs/design/design-tokens.json */
export const SPEND_CATEGORIES = [
  "Food & Groceries",
  "Dining & Restaurants",
  "Transport & Gas",
  "Entertainment",
  "Shopping & Retail",
  "Utilities & Bills",
  "Health & Medical",
  "Travel & Hotels",
  "Subscriptions & Software",
  "Home & Rent",
  "Education",
  "Personal Care",
  "Financial",
  "Income",
  "Transfers (internal)",
  "Uncategorized",
] as const;

export type SpendCategory = (typeof SPEND_CATEGORIES)[number];
