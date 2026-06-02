import accountsData from "@/mocks/accounts.json";
import alertsData from "@/mocks/alerts.json";
import categoriesData from "@/mocks/categories.json";
import moneyFlowData from "@/mocks/money-flow.json";
import summaryData from "@/mocks/summary.json";
import transactionsData from "@/mocks/transactions.json";
import trendsData from "@/mocks/trends.json";
import type {
  AccountsResponse,
  AlertsResponse,
  CategoriesResponse,
  ChartDataResponse,
  MoneyFlowResponse,
  PaginatedTransactions,
  TransactionFilters,
  TransactionSummary,
  TrendsResponse,
} from "@/types/api";

const MOCK_DELAY_MS = 150;

function delay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, MOCK_DELAY_MS);
  });
}

function monthFromDateRange(from?: string, to?: string): string | undefined {
  if (from) {
    return from.slice(0, 7);
  }
  if (to) {
    return to.slice(0, 7);
  }
  return undefined;
}

function transactionMatchesMonth(date: string, month?: string): boolean {
  if (!month) {
    return true;
  }
  return date.startsWith(month);
}

export async function getSummary(
  _from?: string,
  _to?: string,
): Promise<TransactionSummary> {
  await delay();
  return summaryData as TransactionSummary;
}

export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<PaginatedTransactions> {
  await delay();

  const {
    month,
    category,
    accountId,
    q,
    type,
    sort = "date_desc",
    limit = 50,
    cursor,
  } = filters;

  const accountMasks = new Map(
    (accountsData as AccountsResponse).accounts.map((account) => [
      account.id,
      account.mask,
    ]),
  );

  const allItems = (transactionsData as PaginatedTransactions).items.map(
    (tx) => ({
      ...tx,
      accountMask: tx.accountMask ?? accountMasks.get(tx.accountId) ?? null,
    }),
  );

  let filtered = allItems.filter((tx) => {
    if (!transactionMatchesMonth(tx.date, month)) {
      return false;
    }
    if (category && tx.category !== category) {
      return false;
    }
    if (accountId && tx.accountId !== accountId) {
      return false;
    }
    if (type && tx.transactionType !== type) {
      return false;
    }
    if (q) {
      const query = q.toLowerCase();
      const haystack =
        `${tx.name} ${tx.merchantName ?? ""} ${tx.category}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case "date_asc":
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case "amount_desc":
        return Number.parseFloat(b.amount) - Number.parseFloat(a.amount);
      case "amount_asc":
        return Number.parseFloat(a.amount) - Number.parseFloat(b.amount);
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "category_asc":
        return (
          a.category.localeCompare(b.category) ||
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      default:
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
  });

  if (cursor) {
    const cursorIndex = filtered.findIndex((tx) => tx.id === cursor);
    if (cursorIndex >= 0) {
      filtered = filtered.slice(cursorIndex + 1);
    }
  }

  const page = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;
  const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;

  return { items: page, nextCursor };
}

export async function getAccounts(): Promise<AccountsResponse> {
  await delay();
  return accountsData as AccountsResponse;
}

export async function deleteAccount(
  accountId: string,
): Promise<import("@/types/api").DeleteAccountResponse> {
  await delay();
  const data = accountsData as AccountsResponse;
  const account = data.accounts.find((row) => row.id === accountId);
  if (!account) {
    throw new Error("Account not found");
  }
  return {
    id: account.id,
    name: account.name,
    mask: account.mask ?? "0000",
    transactionsDeleted: 0,
  };
}

export async function syncAccount(
  accountId: string,
): Promise<import("@/types/api").PlaidSyncResponse> {
  await delay();
  return {
    status: "completed",
    itemId: "mock-item",
    institutionName: "Mock Bank",
    accountsSynced: 1,
    added: 3,
    modified: 0,
    removed: 0,
  };
}

export async function syncAllPlaid(): Promise<
  import("@/types/api").PlaidSyncAllResponse
> {
  await delay();
  return {
    status: "completed",
    itemsSynced: 2,
    added: 5,
    modified: 1,
    removed: 0,
  };
}

export async function getAlerts(_month?: string): Promise<AlertsResponse> {
  await delay();
  return alertsData as AlertsResponse;
}

export async function getCategories(
  _from?: string,
  _to?: string,
): Promise<CategoriesResponse> {
  await delay();
  return categoriesData as CategoriesResponse;
}

export async function getMoneyFlow(
  _from?: string,
  _to?: string,
): Promise<MoneyFlowResponse> {
  await delay();
  return moneyFlowData as MoneyFlowResponse;
}

export async function getTrends(
  from?: string,
  to?: string,
): Promise<TrendsResponse> {
  await delay();

  const fromMonth = monthFromDateRange(from, to);
  const toMonth = to?.slice(0, 7);

  const trends = (trendsData as TrendsResponse).trends.map((trend) => ({
    ...trend,
    months: trend.months.filter((point) => {
      if (fromMonth && point.month < fromMonth) {
        return false;
      }
      if (toMonth && point.month > toMonth) {
        return false;
      }
      return true;
    }),
  }));

  return { trends };
}

export async function getChartData(params: {
  from?: string;
  to?: string;
  accountId?: string;
  category?: string;
}): Promise<ChartDataResponse> {
  await delay();

  const accounts = (accountsData as AccountsResponse).accounts;
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));

  let items = (transactionsData as PaginatedTransactions).items.filter((tx) => {
    if (params.from && tx.date < params.from) return false;
    if (params.to && tx.date > params.to) return false;
    if (params.accountId && tx.accountId !== params.accountId) return false;
    if (params.category && tx.category !== params.category) return false;
    return true;
  });

  const monthlyMap = new Map<
    string,
    { expenses: number; income: number; net: number }
  >();
  const categoryMap = new Map<string, number>();
  const accountMap = new Map<string, number>();
  const trendMap = new Map<string, Map<string, number>>();

  for (const tx of items) {
    const month = tx.date.slice(0, 7);
    const entry = monthlyMap.get(month) ?? { expenses: 0, income: 0, net: 0 };
    const amount = Number.parseFloat(tx.amount);

    if (tx.transactionType === "expense" && !tx.isTransfer) {
      entry.expenses += amount;
      entry.net -= amount;
      categoryMap.set(tx.category, (categoryMap.get(tx.category) ?? 0) + amount);
      accountMap.set(tx.accountId, (accountMap.get(tx.accountId) ?? 0) + amount);

      const catTrend = trendMap.get(tx.category) ?? new Map<string, number>();
      catTrend.set(month, (catTrend.get(month) ?? 0) + amount);
      trendMap.set(tx.category, catTrend);
    } else if (tx.transactionType === "income" && !tx.isTransfer) {
      entry.income += Math.abs(amount);
      entry.net += Math.abs(amount);
    }

    monthlyMap.set(month, entry);
  }

  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      month,
      expenses: values.expenses.toFixed(2),
      income: values.income.toFixed(2),
      net: values.net.toFixed(2),
    }));

  const categoryTotal = [...categoryMap.values()].reduce((s, v) => s + v, 0);
  const accountTotal = [...accountMap.values()].reduce((s, v) => s + v, 0);

  const byCategory = [...categoryMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({
      name,
      amount: amount.toFixed(2),
      percentage: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
    }));

  const byAccount = [...accountMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([id, amount]) => ({
      id,
      name: accountNames.get(id) ?? "Account",
      amount: amount.toFixed(2),
      percentage: accountTotal > 0 ? (amount / accountTotal) * 100 : 0,
    }));

  const categoryTrends = [...trendMap.entries()]
    .sort(([, a], [, b]) => {
      const totalA = [...a.values()].reduce((s, v) => s + v, 0);
      const totalB = [...b.values()].reduce((s, v) => s + v, 0);
      return totalB - totalA;
    })
    .slice(0, params.category ? 1 : 5)
    .map(([name, monthsMap]) => ({
      name,
      months: [...monthsMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({
          month,
          amount: amount.toFixed(2),
        })),
    }));

  const expenseTotal = monthly.reduce(
    (s, row) => s + Number.parseFloat(row.expenses),
    0,
  );
  const incomeTotal = monthly.reduce(
    (s, row) => s + Number.parseFloat(row.income),
    0,
  );

  return {
    monthly,
    byCategory,
    byAccount,
    categoryTrends,
    totals: {
      expenses: expenseTotal.toFixed(2),
      income: incomeTotal.toFixed(2),
      net: (incomeTotal - expenseTotal).toFixed(2),
    },
  };
}
