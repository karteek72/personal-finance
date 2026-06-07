import { SPEND_CATEGORIES } from "../config/categories.js";
import { getDb } from "../db/client.js";
import { dimCategory } from "../db/schema.js";

export type SpendClass =
  | "fixed"
  | "variable"
  | "discretionary"
  | "income"
  | "transfer";

export interface DimCategoryRow {
  category: string;
  spendClass: SpendClass;
  isEssential: boolean;
  cpiWeightEligible: boolean;
}

/** Default taxonomy — seeded into dim_category on first access. */
export const DIM_CATEGORY_DEFAULTS: Record<
  string,
  Omit<DimCategoryRow, "category">
> = {
  "Food & Groceries": {
    spendClass: "variable",
    isEssential: true,
    cpiWeightEligible: true,
  },
  "Dining & Restaurants": {
    spendClass: "discretionary",
    isEssential: false,
    cpiWeightEligible: false,
  },
  "Housing & Home": {
    spendClass: "fixed",
    isEssential: true,
    cpiWeightEligible: true,
  },
  "Utilities & Bills": {
    spendClass: "fixed",
    isEssential: true,
    cpiWeightEligible: true,
  },
  Transportation: {
    spendClass: "variable",
    isEssential: true,
    cpiWeightEligible: true,
  },
  "Subscriptions & Software": {
    spendClass: "fixed",
    isEssential: false,
    cpiWeightEligible: true,
  },
  "Financial & Insurance": {
    spendClass: "fixed",
    isEssential: true,
    cpiWeightEligible: true,
  },
  "Health & Medical": {
    spendClass: "variable",
    isEssential: true,
    cpiWeightEligible: true,
  },
  Education: {
    spendClass: "variable",
    isEssential: true,
    cpiWeightEligible: false,
  },
  "Shopping & Retail": {
    spendClass: "discretionary",
    isEssential: false,
    cpiWeightEligible: false,
  },
  Entertainment: {
    spendClass: "discretionary",
    isEssential: false,
    cpiWeightEligible: false,
  },
  "Personal Care": {
    spendClass: "variable",
    isEssential: true,
    cpiWeightEligible: false,
  },
  "Family & Kids": {
    spendClass: "variable",
    isEssential: true,
    cpiWeightEligible: false,
  },
  Pet: {
    spendClass: "variable",
    isEssential: false,
    cpiWeightEligible: false,
  },
  "Gifts & Donations": {
    spendClass: "discretionary",
    isEssential: false,
    cpiWeightEligible: false,
  },
  "Business & Professional": {
    spendClass: "variable",
    isEssential: false,
    cpiWeightEligible: false,
  },
  Travel: {
    spendClass: "discretionary",
    isEssential: false,
    cpiWeightEligible: false,
  },
  Income: { spendClass: "income", isEssential: false, cpiWeightEligible: false },
  "Transfers (internal)": {
    spendClass: "transfer",
    isEssential: false,
    cpiWeightEligible: false,
  },
  Uncategorized: {
    spendClass: "variable",
    isEssential: false,
    cpiWeightEligible: false,
  },
};

let cachedMap: Map<string, DimCategoryRow> | null = null;

function rowFromDefaults(category: string): DimCategoryRow {
  const defaults = DIM_CATEGORY_DEFAULTS[category] ?? {
    spendClass: "variable" as const,
    isEssential: false,
    cpiWeightEligible: false,
  };
  return { category, ...defaults };
}

/** Ensure dim_category is populated from the canonical taxonomy. */
export async function ensureDimCategorySeeded(): Promise<void> {
  const db = getDb();
  for (const category of SPEND_CATEGORIES) {
    const defaults = DIM_CATEGORY_DEFAULTS[category];
    if (!defaults) continue;
    await db
      .insert(dimCategory)
      .values({
        category,
        spendClass: defaults.spendClass,
        isEssential: defaults.isEssential,
        cpiWeightEligible: defaults.cpiWeightEligible,
      })
      .onConflictDoNothing();
  }
}

/** Load dim_category rows (cached per process). User category rules apply at txn ingest. */
export async function getDimCategoryMap(): Promise<Map<string, DimCategoryRow>> {
  if (cachedMap) return cachedMap;

  await ensureDimCategorySeeded();
  const db = getDb();
  const rows = await db.select().from(dimCategory);

  cachedMap = new Map(
    rows.map((row) => [
      row.category,
      {
        category: row.category,
        spendClass: row.spendClass as SpendClass,
        isEssential: row.isEssential,
        cpiWeightEligible: row.cpiWeightEligible,
      },
    ]),
  );

  for (const category of SPEND_CATEGORIES) {
    if (!cachedMap.has(category)) {
      cachedMap.set(category, rowFromDefaults(category));
    }
  }

  return cachedMap;
}

export async function isEssentialCategoryName(category: string): Promise<boolean> {
  const map = await getDimCategoryMap();
  return map.get(category)?.isEssential ?? false;
}

export async function essentialCategoryNames(): Promise<string[]> {
  const map = await getDimCategoryMap();
  return [...map.values()]
    .filter((row) => row.isEssential)
    .map((row) => row.category);
}

export async function nonEssentialExpenseCategoryNames(): Promise<string[]> {
  const map = await getDimCategoryMap();
  return [...map.values()]
    .filter(
      (row) =>
        !row.isEssential &&
        row.spendClass !== "income" &&
        row.spendClass !== "transfer",
    )
    .map((row) => row.category);
}

export async function categoriesForSpendClass(
  spendClass: SpendClass,
): Promise<string[]> {
  const map = await getDimCategoryMap();
  return [...map.values()]
    .filter((row) => row.spendClass === spendClass)
    .map((row) => row.category);
}

export async function lookupDimCategory(
  category: string,
): Promise<DimCategoryRow> {
  const map = await getDimCategoryMap();
  return map.get(category) ?? rowFromDefaults(category);
}

/** Test hook — reset in-process cache after seed changes. */
export function resetDimCategoryCache(): void {
  cachedMap = null;
}

/** Verify a category exists in dim_category (throws in strict contexts). */
export async function assertCategoryInDim(category: string): Promise<void> {
  const map = await getDimCategoryMap();
  if (!map.has(category)) {
    await getDb()
      .insert(dimCategory)
      .values({
        category,
        spendClass: "variable",
        isEssential: false,
        cpiWeightEligible: false,
      })
      .onConflictDoNothing();
    resetDimCategoryCache();
  }
}
