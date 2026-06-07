/** Essential spend categories — backed by dim_category at runtime. */
export {
  essentialCategoryNames,
  isEssentialCategoryName as isEssentialCategory,
} from "../dim-category-store.js";

/** Sync fallback for unit tests without DB. */
export const ESSENTIAL_CATEGORIES = new Set<string>([
  "Food & Groceries",
  "Housing & Home",
  "Utilities & Bills",
  "Transportation",
  "Health & Medical",
  "Financial & Insurance",
  "Education",
  "Family & Kids",
  "Personal Care",
]);
