/** Matches backend `CategorizationStatus` for transaction list filters. */
export type CategorizationStatusFilter =
  | "uncategorized"
  | "missing_subcategory"
  | "needs_review";

export const CATEGORIZATION_STATUS_OPTIONS: {
  value: CategorizationStatusFilter | "";
  label: string;
}[] = [
  { value: "", label: "All transactions" },
  { value: "needs_review", label: "Needs review" },
  { value: "uncategorized", label: "Uncategorized" },
  { value: "missing_subcategory", label: "Missing subcategory" },
];

export function isCategorizationStatusFilter(
  value: string,
): value is CategorizationStatusFilter {
  return (
    value === "uncategorized" ||
    value === "missing_subcategory" ||
    value === "needs_review"
  );
}

export function transactionNeedsCategorizationReview(input: {
  category: string;
  subCategory: string | null | undefined;
  transactionType: string;
  isTransfer: boolean;
}): boolean {
  if (input.transactionType !== "expense" || input.isTransfer) {
    return false;
  }
  if (input.category === "Uncategorized") {
    return true;
  }
  return input.subCategory == null || input.subCategory.trim() === "";
}
