/** Category chart colors from docs/design/design-tokens.json */
export const categoryColors = {
  "Food & Groceries": "#3B82F6",
  "Dining & Restaurants": "#F97316",
  "Transport & Gas": "#6B7280",
  Entertainment: "#A855F7",
  "Shopping & Retail": "#22C55E",
  "Utilities & Bills": "#6366F1",
  "Health & Medical": "#EC4899",
  "Travel & Hotels": "#14B8A6",
  "Subscriptions & Software": "#EF4444",
  "Home & Rent": "#EAB308",
  Education: "#8B5CF6",
  "Personal Care": "#F43F5E",
  Financial: "#64748B",
  Income: "#437a22",
  "Transfers (internal)": "#01696f",
} as const satisfies Record<string, string>;

const DEFAULT_COLOR = "#7c3aed";

export function getCategoryColor(name: string): string {
  return categoryColors[name as keyof typeof categoryColors] ?? DEFAULT_COLOR;
}
