import * as mockApi from "@/lib/mock-api";
import type {
  AccountsResponse,
  AlertsResponse,
  CategoriesResponse,
  ChartDataFilters,
  ChartDataResponse,
  DeleteAccountResponse,
  MoneyFlowResponse,
  PaginatedTransactions,
  PlaidExchangeResponse,
  PlaidItemsResponse,
  PlaidSyncAllResponse,
  PlaidSyncResponse,
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
    return fetchJson<AccountsResponse>("/accounts");
  },

  deleteAccount(accountId: string): Promise<DeleteAccountResponse> {
    if (USE_MOCKS) {
      return mockApi.deleteAccount(accountId);
    }
    return fetchJson<DeleteAccountResponse>(`/accounts/${accountId}`, {
      method: "DELETE",
    });
  },

  syncAccount(accountId: string): Promise<PlaidSyncResponse> {
    if (USE_MOCKS) {
      return mockApi.syncAccount(accountId);
    }
    return fetchJson<PlaidSyncResponse>(`/accounts/${accountId}/sync`, {
      method: "POST",
    });
  },

  syncAllPlaid(): Promise<PlaidSyncAllResponse> {
    if (USE_MOCKS) {
      return mockApi.syncAllPlaid();
    }
    return fetchJson<PlaidSyncAllResponse>("/plaid/sync", {
      method: "POST",
    });
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

  getChartData(filters: ChartDataFilters = {}): Promise<ChartDataResponse> {
    if (USE_MOCKS) {
      return mockApi.getChartData(filters);
    }
    return fetchJson<ChartDataResponse>(
      `/transactions/chart-data${buildQuery({
        from: filters.from,
        to: filters.to,
        accountId: filters.accountId,
        category: filters.category,
      })}`,
    );
  },

  createPlaidLinkToken(platform: "web" | "ios" = "web"): Promise<{ linkToken: string }> {
    if (USE_MOCKS) {
      return Promise.resolve({ linkToken: "mock-link-token" });
    }
    return fetchJson<{ linkToken: string }>("/plaid/link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
  },

  exchangePlaidToken(publicToken: string): Promise<PlaidExchangeResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        itemId: "mock-item",
        institutionName: "Mock Bank",
        accountsSynced: 1,
        transactionsAdded: 0,
        message: "Mock exchange complete",
      });
    }
    return fetchJson<PlaidExchangeResponse>("/plaid/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicToken }),
    });
  },

  syncPlaidItem(itemId: string): Promise<PlaidSyncResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        status: "completed",
        itemId,
        institutionName: "Mock Bank",
        accountsSynced: 1,
        added: 0,
        modified: 0,
        removed: 0,
      });
    }
    return fetchJson<PlaidSyncResponse>(`/plaid/items/${itemId}/sync`, {
      method: "POST",
    });
  },
};

export const getSummary = api.getSummary.bind(api);
export const getTransactions = api.getTransactions.bind(api);
export const getAccounts = api.getAccounts.bind(api);
export const getAlerts = api.getAlerts.bind(api);
export const getCategories = api.getCategories.bind(api);
export const getMoneyFlow = api.getMoneyFlow.bind(api);
export const getTrends = api.getTrends.bind(api);
