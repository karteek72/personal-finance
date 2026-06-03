import { isValidCategory } from "../config/categories.js";
import {
  applyMerchantCategoryRule,
  type CategoryRule,
} from "./category-rules.js";
import { inferClassification } from "./infer-subcategory.js";
import { resolveInternalTransfer } from "./transfer-classification.js";

/** Parser / legacy category labels mapped to canonical spend categories. */
const LEGACY_CATEGORY_HINTS: Record<string, string> = {
  "Transport & Gas": "Transportation",
  Financial: "Financial & Insurance",
  Transfers: "Transfers (internal)",
  "Home & Rent": "Housing & Home",
};

function normalizeCategoryHint(hint: string): string {
  const trimmed = hint.trim() || "Uncategorized";
  const mapped = LEGACY_CATEGORY_HINTS[trimmed];
  if (mapped) {
    return mapped;
  }
  if (isValidCategory(trimmed)) {
    return trimmed;
  }
  return "Uncategorized";
}

export interface ClassifyBankingTransactionInput {
  categoryHint: string;
  name: string;
  merchantName: string | null;
  categoryRules: Map<string, CategoryRule>;
  pfcDetailed?: string | null;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
}

export interface ClassifiedBankingTransaction {
  category: string;
  subCategory: string | null;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
}

/** Same pipeline as Plaid sync: infer → merchant rules → internal transfer resolution. */
export function classifyBankingTransaction(
  input: ClassifyBankingTransactionInput,
): ClassifiedBankingTransaction {
  const categoryHint = normalizeCategoryHint(input.categoryHint);

  const inferred = inferClassification(
    categoryHint,
    input.merchantName,
    input.name,
  );

  const { category, subCategory } = applyMerchantCategoryRule(
    input.categoryRules,
    input.merchantName,
    input.name,
    inferred.category,
    inferred.subCategory,
  );

  const resolved = resolveInternalTransfer({
    category,
    subCategory,
    name: input.name,
    merchantName: input.merchantName,
    pfcDetailed: input.pfcDetailed ?? null,
  });

  return {
    category: resolved?.category ?? category,
    subCategory: resolved?.subCategory ?? subCategory,
    transactionType: resolved?.transactionType ?? input.transactionType,
    isTransfer: resolved?.isTransfer ?? input.isTransfer,
  };
}
