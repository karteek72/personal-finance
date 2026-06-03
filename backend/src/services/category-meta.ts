/** Category display metadata — aligned with design-tokens.json chart colors. */
export const CATEGORY_META: Record<
  string,
  { emoji: string; color: string }
> = {
  "Food & Groceries": { emoji: "🛒", color: "#3B82F6" },
  "Dining & Restaurants": { emoji: "🍽️", color: "#F97316" },
  "Housing & Home": { emoji: "🏠", color: "#EAB308" },
  "Utilities & Bills": { emoji: "💡", color: "#6366F1" },
  Transportation: { emoji: "🚗", color: "#6B7280" },
  "Subscriptions & Software": { emoji: "📱", color: "#EF4444" },
  "Financial & Insurance": { emoji: "🏦", color: "#64748B" },
  "Health & Medical": { emoji: "💊", color: "#EC4899" },
  Education: { emoji: "📚", color: "#8B5CF6" },
  "Shopping & Retail": { emoji: "🛍️", color: "#22C55E" },
  Entertainment: { emoji: "🎬", color: "#A855F7" },
  "Personal Care": { emoji: "🧴", color: "#F43F5E" },
  "Family & Kids": { emoji: "👨‍👩‍👧", color: "#FB923C" },
  Pet: { emoji: "🐾", color: "#84CC16" },
  "Gifts & Donations": { emoji: "🎁", color: "#E879F9" },
  "Business & Professional": { emoji: "💼", color: "#94A3B8" },
  Travel: { emoji: "✈️", color: "#14B8A6" },
  Uncategorized: { emoji: "💸", color: "#6366F1" },
};

export function categoryMeta(category: string): {
  emoji: string;
  color: string;
} {
  return CATEGORY_META[category] ?? { emoji: "💸", color: "#6366F1" };
}
