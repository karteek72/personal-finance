/** Category chart colors from docs/design/design-tokens.json */
export const categoryColors = {
  "Food & Groceries": "#3B82F6",
  "Dining & Restaurants": "#F97316",
  "Housing & Home": "#EAB308",
  "Utilities & Bills": "#6366F1",
  Transportation: "#6B7280",
  "Subscriptions & Software": "#EF4444",
  "Financial & Insurance": "#64748B",
  "Health & Medical": "#EC4899",
  Education: "#8B5CF6",
  "Shopping & Retail": "#22C55E",
  Entertainment: "#A855F7",
  "Personal Care": "#F43F5E",
  "Family & Kids": "#FB923C",
  Pet: "#84CC16",
  "Gifts & Donations": "#E879F9",
  "Business & Professional": "#94A3B8",
  Travel: "#14B8A6",
  Income: "#437a22",
  "Transfers (internal)": "#01696f",
  Uncategorized: "#7c3aed",
  // Legacy labels (imported data before rename)
  "Transport & Gas": "#6B7280",
  Financial: "#64748B",
  "Home & Rent": "#EAB308",
  "Travel & Hotels": "#14B8A6",
} as const satisfies Record<string, string>;

const DEFAULT_COLOR = "#7c3aed";

export function getCategoryColor(name: string): string {
  return categoryColors[name as keyof typeof categoryColors] ?? DEFAULT_COLOR;
}

/** Shades of a parent category color for subcategory charts. */
export function getSubCategoryColor(parentCategory: string, index: number): string {
  const base = getCategoryColor(parentCategory);
  if (!base.startsWith("#") || base.length < 7) {
    return base;
  }
  const opacities = [1, 0.82, 0.66, 0.52, 0.4, 0.32, 0.26];
  const opacity = opacities[Math.min(index, opacities.length - 1)] ?? 0.22;
  const r = Number.parseInt(base.slice(1, 3), 16);
  const g = Number.parseInt(base.slice(3, 5), 16);
  const b = Number.parseInt(base.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
