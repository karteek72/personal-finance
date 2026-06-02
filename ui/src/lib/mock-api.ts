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
