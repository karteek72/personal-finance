import * as mockApi from "@/lib/mock-api";
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

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: { message?: string } }).error?.message ===
        "string"
        ? (body as { error: { message: string } }).error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getSummary(from?: string, to?: string): Promise<TransactionSummary> {
    if (USE_MOCKS) {
      return mockApi.getSummary(from, to);
    }
    return fetchJson<TransactionSummary>(
      `/transactions/summary${buildQuery({ from, to })}`,
    );
  },

  getTransactions(
    filters: TransactionFilters = {},
  ): Promise<PaginatedTransactions> {
    if (USE_MOCKS) {
      return mockApi.getTransactions(filters);
    }
    return fetchJson<PaginatedTransactions>(
      `/transactions${buildQuery({
        month: filters.month,
        category: filters.category,
        accountId: filters.accountId,
        q: filters.q,
        type: filters.type,
        sort: filters.sort,
        limit: filters.limit,
        cursor: filters.cursor,
      })}`,
    );
  },

  getAccounts(): Promise<AccountsResponse> {
    if (USE_MOCKS) {
      return mockApi.getAccounts();
    }
    return fetchJson<AccountsResponse>("/plaid/accounts");
  },

  getAlerts(month?: string): Promise<AlertsResponse> {
    if (USE_MOCKS) {
      return mockApi.getAlerts(month);
    }
    return fetchJson<AlertsResponse>(
      `/insights/alerts${buildQuery({ month })}`,
    );
  },

  getCategories(from?: string, to?: string): Promise<CategoriesResponse> {
    if (USE_MOCKS) {
      return mockApi.getCategories(from, to);
    }
    return fetchJson<CategoriesResponse>(
      `/transactions/by-category${buildQuery({ from, to })}`,
    );
  },

  getMoneyFlow(from?: string, to?: string): Promise<MoneyFlowResponse> {
    if (USE_MOCKS) {
      return mockApi.getMoneyFlow(from, to);
    }
    return fetchJson<MoneyFlowResponse>(
      `/transactions/flow${buildQuery({ from, to })}`,
    );
  },

  getTrends(from?: string, to?: string): Promise<TrendsResponse> {
    if (USE_MOCKS) {
      return mockApi.getTrends(from, to);
    }
    return fetchJson<TrendsResponse>(
      `/insights/trends${buildQuery({ from, to })}`,
    );
  },
};

export const getSummary = api.getSummary.bind(api);
export const getTransactions = api.getTransactions.bind(api);
export const getAccounts = api.getAccounts.bind(api);
export const getAlerts = api.getAlerts.bind(api);
export const getCategories = api.getCategories.bind(api);
export const getMoneyFlow = api.getMoneyFlow.bind(api);
export const getTrends = api.getTrends.bind(api);
