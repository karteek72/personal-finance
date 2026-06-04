import type { QueryClient } from "@tanstack/react-query";

/** Query key prefixes invalidated after account delete or Plaid disconnect. */
const FINANCIAL_QUERY_KEYS = [
  "accounts",
  "credit-debt",
  "transactions",
  "summary",
  "categories",
  "chart-data",
  "money-flow",
  "alerts",
  "household-insights",
  "net-worth",
  "investments",
  "wellness",
  "dna",
  "patterns",
  "behavioral",
  "merchants",
  "wrapped",
  "recurring",
  "calendar",
  "forecast",
  "budgets",
  "fire",
  "trends",
] as const;

export function invalidateFinancialQueries(queryClient: QueryClient): void {
  for (const key of FINANCIAL_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export async function refetchCoreFinancialQueries(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ["accounts"] }),
    queryClient.refetchQueries({ queryKey: ["summary"] }),
    queryClient.refetchQueries({ queryKey: ["credit-debt"] }),
  ]);
}
