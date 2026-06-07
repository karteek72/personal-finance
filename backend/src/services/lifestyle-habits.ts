import {
  SUBCATEGORY_MAP,
  type SpendCategory,
} from "../config/categories.js";

export interface DerivedLifestyleHabit {
  id: string;
  emoji: string | null;
  label: string;
  monthly: string;
}

const SUBSCRIPTIONS_CATEGORY = "Subscriptions & Software" as const satisfies SpendCategory;
const DINING_CATEGORY = "Dining & Restaurants" as const satisfies SpendCategory;
const TRANSPORTATION_CATEGORY = "Transportation" as const satisfies SpendCategory;

const COFFEE_SUBCATEGORY =
  SUBCATEGORY_MAP["Dining & Restaurants"].find((s) => s === "Cafes & Coffee")!;

const HABIT_DEFS: Array<{
  id: string;
  emoji: string;
  label: string;
  subCategories?: readonly string[];
  categories?: readonly string[];
  merchantPattern?: RegExp;
  minMonthly: number;
}> = [
  {
    id: "coffee-runs",
    emoji: "☕",
    label: "Coffee runs",
    subCategories: [COFFEE_SUBCATEGORY],
    merchantPattern: /starbucks|coffee|blue bottle|philz|dunkin|peet/i,
    minMonthly: 15,
  },
  {
    id: "dining-out",
    emoji: "🍔",
    label: "Dining out & delivery",
    categories: [DINING_CATEGORY],
    subCategories: [
      "Sit-down Restaurants",
      "Fast Food & Takeout",
      "Food Delivery",
      "Bars & Nightlife",
    ] as const,
    minMonthly: 40,
  },
  {
    id: "rideshare",
    emoji: "🚗",
    label: "Rideshare",
    categories: [TRANSPORTATION_CATEGORY],
    merchantPattern: /uber(?!\s*eats)|lyft|taxi|cab\b/i,
    minMonthly: 20,
  },
  {
    id: "subscriptions",
    emoji: "📺",
    label: "Subscriptions",
    categories: [SUBSCRIPTIONS_CATEGORY],
    minMonthly: 10,
  },
];

/** Every category/subcategory referenced by habit matchers. Exported for taxonomy tests. */
export function habitMatcherTaxonomyRefs(): Array<{
  habitId: string;
  categories: readonly string[];
  subCategories: readonly string[];
}> {
  return HABIT_DEFS.map((def) => ({
    habitId: def.id,
    categories: def.categories ?? [],
    subCategories: def.subCategories ?? [],
  }));
}

/** Spending habits for Time Machine when lifestyle_habits rows are not seeded. */
export async function deriveLifestyleHabitsFromTransactions(
  userIds: string[],
  lookbackMonths = 3,
): Promise<DerivedLifestyleHabit[]> {
  const { detectRecurringFromTransactions } = await import(
    "./detect-recurring.js"
  );
  const { auditsToLegacyHabits, generateCostAudits } = await import(
    "./cost-audit-engine.js"
  );
  const recurring = await detectRecurringFromTransactions(userIds);
  const audits = await generateCostAudits(userIds, recurring, lookbackMonths);
  return auditsToLegacyHabits(audits);
}
