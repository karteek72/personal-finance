/** Spend categories — keep aligned with docs/design/design-tokens.json */
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

const CATEGORY_SET = new Set<string>(SPEND_CATEGORIES);

export function isValidCategory(value: string): value is SpendCategory {
  return CATEGORY_SET.has(value);
}
