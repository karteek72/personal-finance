import {
  SUBCATEGORY_MAP,
  type SpendCategory,
  isValidCategory,
  isValidSubCategory,
} from "../config/categories.js";

const SUBSCRIPTIONS = "Subscriptions & Software" as const satisfies SpendCategory;
const ENTERTAINMENT = "Entertainment" as const satisfies SpendCategory;

/** Categories treated as subscriptions in recurring detection. */
export const SUBSCRIPTION_CATEGORIES = new Set<string>([
  SUBSCRIPTIONS,
  ENTERTAINMENT,
]);

/** Discretionary spend categories for lifestyle audits (until dim_category ships). */
export const DISCRETIONARY_CATEGORIES = new Set<string>([
  "Dining & Restaurants",
  ENTERTAINMENT,
  "Shopping & Retail",
  SUBSCRIPTIONS,
  "Personal Care",
  "Transportation",
  "Travel",
] as const satisfies readonly SpendCategory[]);

export const SUBSCRIPTION_LANES: Array<{
  id: string;
  label: string;
  emoji: string;
  pattern: RegExp;
}> = [
  {
    id: "streaming-video",
    label: "streaming video",
    emoji: "📺",
    pattern: /netflix|hulu|disney\+?|max\b|hbomax|prime video|peacock|paramount\+/i,
  },
  {
    id: "music",
    label: "music",
    emoji: "🎵",
    pattern: /spotify|apple music|tidal|youtube music|pandora/i,
  },
  {
    id: "cloud-storage",
    label: "cloud storage",
    emoji: "☁️",
    pattern: /icloud|dropbox|google one|google storage|onedrive/i,
  },
  {
    id: "productivity",
    label: "productivity software",
    emoji: "💻",
    pattern: /adobe|creative cloud|microsoft 365|office 365|notion|chatgpt|openai/i,
  },
];

const DELIVERY_PATTERN =
  /doordash|uber\s*eats|grubhub|postmates|seamless|deliveroo/i;

export function isDeliverySpend(
  merchantText: string,
  subCategory: string | null,
): boolean {
  return (
    subCategory === "Food Delivery" || DELIVERY_PATTERN.test(merchantText)
  );
}

export function subscriptionLaneForMerchant(merchantName: string): string | null {
  for (const lane of SUBSCRIPTION_LANES) {
    if (lane.pattern.test(merchantName)) return lane.id;
  }
  return null;
}

/** Resolve subcategory emoji from taxonomy parent. */
export function subCategoryEmoji(
  category: string,
  subCategory: string,
): string {
  if (!isValidSubCategory(category, subCategory)) return "💸";
  const emojiBySub: Partial<Record<string, string>> = {
    "Cafes & Coffee": "☕",
    "Fast Food & Takeout": "🍔",
    "Food Delivery": "🍔",
    "Sit-down Restaurants": "🍽️",
    "Bars & Nightlife": "🍸",
    "Rideshare & Taxi": "🚗",
    "Streaming Video": "📺",
    "Music & Podcasts": "🎵",
    Gaming: "🎮",
    "Fitness & Gym": "💪",
  };
  return emojiBySub[subCategory] ?? "💸";
}

export function getSubCategoriesForAudit(
  category: SpendCategory,
): readonly string[] {
  return SUBCATEGORY_MAP[category];
}

/** Every category name referenced by analytics matchers. Exported for taxonomy tests. */
export function analyticsCategoryRefs(): readonly string[] {
  return [...new Set([...SUBSCRIPTION_CATEGORIES, ...DISCRETIONARY_CATEGORIES])];
}

/** Assert every analytics category ref exists in the canonical taxonomy. */
export function assertAnalyticsCategoriesInTaxonomy(): void {
  for (const name of analyticsCategoryRefs()) {
    if (!isValidCategory(name)) {
      throw new Error(`Analytics references unknown category: ${name}`);
    }
  }
}
