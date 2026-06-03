import * as mockApi from "@/lib/mock-api";
import { getAccessToken } from "@/lib/auth-session";
import type {
  AuthRefreshResponse,
  AuthSessionResponse,
  AccountsResponse,
  AlertsResponse,
  BehavioralResponse,
  BudgetsResponse,
  CalendarResponse,
  CategoriesResponse,
  ChartDataFilters,
  ChartDataResponse,
  CoachResponse,
  CoachAskResponse,
  CreditDebtSummary,
  DeleteAccountResponse,
  DnaResponse,
  FireResponse,
  ForecastResponse,
  HouseholdInsightsResponse,
  HouseholdInviteAcceptResponse,
  HouseholdInvitePreview,
  HouseholdInviteResponse,
  HouseholdMember,
  HouseholdResponse,
  InflationResponse,
  InvestmentsResponse,
  MerchantsResponse,
  MoneyFlowResponse,
  NetWorthResponse,
  PaginatedTransactions,
  PatternsResponse,
  PlaidExchangeResponse,
  PlaidItemsResponse,
  PlaidSyncAllResponse,
  PlaidSyncResponse,
  RecurringResponse,
  ResilienceResponse,
  TransactionFilters,
  TransactionSummary,
  TrendsResponse,
  UpdateTransactionCategoryResponse,
  WellnessResponse,
  WrappedResponse,
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

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!response.ok && response.status !== 202) {
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
  signInWithGoogle(idToken: string): Promise<AuthSessionResponse> {
    return fetchJson<AuthSessionResponse>("/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  },

  async signOut(): Promise<void> {
    const response = await fetch(`${getBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...authHeaders(),
      },
    });
    if (!response.ok && response.status !== 204) {
      throw new Error("Sign out failed");
    }
  },

  refreshSession(refreshToken: string): Promise<AuthRefreshResponse> {
    return fetchJson<AuthRefreshResponse>("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  },

  getSummary(from?: string, to?: string): Promise<TransactionSummary> {
    if (USE_MOCKS) {
      return mockApi.getSummary(from, to);
    }
    return fetchJson<TransactionSummary>(
      `/transactions/summary${buildQuery({ from, to })}`,
    );
  },

  updateTransactionCategory(
    transactionId: string,
    category: string,
    subCategory: string | null = null,
    rememberForMerchant = true,
  ): Promise<UpdateTransactionCategoryResponse> {
    if (USE_MOCKS) {
      return mockApi.updateTransactionCategory(
        transactionId,
        category,
        subCategory,
        rememberForMerchant,
      );
    }
    return fetchJson<UpdateTransactionCategoryResponse>(
      `/transactions/${transactionId}/category`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subCategory, rememberForMerchant }),
      },
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
        subCategory: filters.subCategory,
        accountId: filters.accountId,
        q: filters.q,
        type: filters.type,
        sort: filters.sort,
        limit: filters.limit,
        cursor: filters.cursor,
        memberId: filters.memberId,
        scope: filters.scope,
      })}`,
    );
  },

  async exportTransactionsCsv(
    filters: Omit<TransactionFilters, "limit" | "cursor"> = {},
  ): Promise<void> {
    const path = `/transactions/export.csv${buildQuery({
      month: filters.month,
      category: filters.category,
      subCategory: filters.subCategory,
      accountId: filters.accountId,
      q: filters.q,
      type: filters.type,
      sort: filters.sort,
      memberId: filters.memberId,
      scope: filters.scope,
    })}`;

    if (USE_MOCKS) {
      await exportMockTransactionsCsv(filters);
      return;
    }

    const response = await fetch(`${getBaseUrl()}${path}`, {
      headers: authHeaders(),
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
          : `Export failed with status ${response.status}`;
      throw new Error(message);
    }

    const blob = await response.blob();
    const filename =
      parseContentDispositionFilename(
        response.headers.get("Content-Disposition"),
      ) ?? "transactions.csv";
    triggerBrowserDownload(blob, filename);
  },

  getAccounts(): Promise<AccountsResponse> {
    if (USE_MOCKS) {
      return mockApi.getAccounts();
    }
    return fetchJson<AccountsResponse>("/accounts");
  },

  getCreditDebtSummary(): Promise<CreditDebtSummary> {
    if (USE_MOCKS) {
      return mockApi.getCreditDebtSummary();
    }
    return fetchJson<CreditDebtSummary>("/liabilities/summary");
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
        memberId: filters.memberId,
        scope: filters.scope,
      })}`,
    );
  },

  getHousehold(): Promise<HouseholdResponse> {
    if (USE_MOCKS) {
      return mockApi.getHousehold();
    }
    return fetchJson<HouseholdResponse>("/household");
  },

  updateHouseholdName(name: string): Promise<{ id: string; name: string }> {
    if (USE_MOCKS) {
      return mockApi.updateHouseholdName(name);
    }
    return fetchJson("/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  },

  getHouseholdInsights(): Promise<HouseholdInsightsResponse> {
    if (USE_MOCKS) {
      return mockApi.getHouseholdInsights();
    }
    return fetchJson<HouseholdInsightsResponse>("/household/insights");
  },

  createHouseholdMember(input: {
    displayName: string;
    role: "partner" | "child" | "other";
  }): Promise<HouseholdMember> {
    if (USE_MOCKS) {
      return mockApi.createHouseholdMember(input);
    }
    return fetchJson<HouseholdMember>("/household/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  updateHouseholdMember(
    memberId: string,
    input: { displayName?: string; role?: HouseholdMember["role"] },
  ): Promise<HouseholdMember> {
    if (USE_MOCKS) {
      return mockApi.updateHouseholdMember(memberId, input);
    }
    return fetchJson<HouseholdMember>(`/household/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  deleteHouseholdMember(memberId: string): Promise<{ status: string }> {
    if (USE_MOCKS) {
      return mockApi.deleteHouseholdMember(memberId);
    }
    return fetchJson(`/household/members/${memberId}`, { method: "DELETE" });
  },

  assignAccountToMember(
    accountId: string,
    memberId: string,
  ): Promise<{ accountId: string; memberId: string }> {
    if (USE_MOCKS) {
      return mockApi.assignAccountToMember(accountId, memberId);
    }
    return fetchJson(`/household/accounts/${accountId}/assign`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
  },

  inviteHouseholdMember(
    memberId: string,
    email: string,
  ): Promise<HouseholdInviteResponse> {
    if (USE_MOCKS) {
      return mockApi.inviteHouseholdMember(memberId, email);
    }
    return fetchJson<HouseholdInviteResponse>(
      `/household/members/${memberId}/invite`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );
  },

  revokeHouseholdInvite(memberId: string): Promise<{ status: string }> {
    if (USE_MOCKS) {
      return mockApi.revokeHouseholdInvite(memberId);
    }
    return fetchJson(`/household/members/${memberId}/invite`, {
      method: "DELETE",
    });
  },

  previewHouseholdInvite(token: string): Promise<HouseholdInvitePreview> {
    if (USE_MOCKS) {
      return mockApi.previewHouseholdInvite(token);
    }
    return fetchJson<HouseholdInvitePreview>(
      `/household/invites/preview?token=${encodeURIComponent(token)}`,
    );
  },

  acceptHouseholdInvite(
    token: string,
  ): Promise<HouseholdInviteAcceptResponse> {
    if (USE_MOCKS) {
      return mockApi.acceptHouseholdInvite(token);
    }
    return fetchJson<HouseholdInviteAcceptResponse>("/household/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  },

  createPlaidLinkToken(
    platform: "web" | "ios" = "web",
    itemId?: string,
  ): Promise<{ linkToken: string }> {
    if (USE_MOCKS) {
      return Promise.resolve({ linkToken: "mock-link-token" });
    }
    return fetchJson<{ linkToken: string }>("/plaid/link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, itemId }),
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

  getNetWorth(): Promise<NetWorthResponse> {
    if (USE_MOCKS) return mockApi.getNetWorth();
    return fetchJson<NetWorthResponse>("/wealth/net-worth");
  },

  getInvestments(): Promise<InvestmentsResponse> {
    if (USE_MOCKS) return mockApi.getInvestments();
    return fetchJson<InvestmentsResponse>("/wealth/investments");
  },

  getFire(): Promise<FireResponse> {
    if (USE_MOCKS) return mockApi.getFire();
    return fetchJson<FireResponse>("/wealth/fire");
  },

  getBudgets(): Promise<BudgetsResponse> {
    if (USE_MOCKS) return mockApi.getBudgets();
    return fetchJson<BudgetsResponse>("/planning/budgets");
  },

  getRecurring(): Promise<RecurringResponse> {
    if (USE_MOCKS) return mockApi.getRecurring();
    return fetchJson<RecurringResponse>("/planning/recurring");
  },

  getCalendar(): Promise<CalendarResponse> {
    if (USE_MOCKS) return mockApi.getCalendar();
    return fetchJson<CalendarResponse>("/planning/calendar");
  },

  getForecast(): Promise<ForecastResponse> {
    if (USE_MOCKS) return mockApi.getForecast();
    return fetchJson<ForecastResponse>("/planning/forecast");
  },

  getWellness(): Promise<WellnessResponse> {
    if (USE_MOCKS) return mockApi.getWellness();
    return fetchJson<WellnessResponse>("/insights/wellness");
  },

  getDna(): Promise<DnaResponse> {
    if (USE_MOCKS) return mockApi.getDna();
    return fetchJson<DnaResponse>("/insights/dna");
  },

  getPatterns(): Promise<PatternsResponse> {
    if (USE_MOCKS) return mockApi.getPatterns();
    return fetchJson<PatternsResponse>("/insights/patterns");
  },

  getBehavioral(): Promise<BehavioralResponse> {
    if (USE_MOCKS) return mockApi.getBehavioral();
    return fetchJson<BehavioralResponse>("/insights/behavioral");
  },

  getMerchants(): Promise<MerchantsResponse> {
    if (USE_MOCKS) return mockApi.getMerchants();
    return fetchJson<MerchantsResponse>("/insights/merchants");
  },

  getInflation(): Promise<InflationResponse> {
    if (USE_MOCKS) return mockApi.getInflation();
    return fetchJson<InflationResponse>("/protect/inflation");
  },

  getResilience(): Promise<ResilienceResponse> {
    if (USE_MOCKS) return mockApi.getResilience();
    return fetchJson<ResilienceResponse>("/protect/resilience");
  },

  getCoach(): Promise<CoachResponse> {
    if (USE_MOCKS) return mockApi.getCoach();
    return fetchJson<CoachResponse>("/coach/insights");
  },

  askCoach(question: string): Promise<CoachAskResponse> {
    if (USE_MOCKS) {
      const qa = mockApi.getCoach();
      return qa.then((coach) => {
        const match = coach.qa.find((x) =>
          question.toLowerCase().includes(x.q.slice(0, 20).toLowerCase()),
        );
        return {
          answer: match?.a ?? coach.qa[0]?.a ?? "I don't have enough context to answer that yet.",
          isLive: false,
        };
      });
    }
    return fetchJson<CoachAskResponse>("/coach/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
  },

  getWrapped(): Promise<WrappedResponse> {
    if (USE_MOCKS) return mockApi.getWrapped();
    return fetchJson<WrappedResponse>("/wrapped");
  },
};

function parseContentDispositionFilename(
  header: string | null,
): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/.exec(header);
  return match?.[1] ?? null;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",");
}

async function exportMockTransactionsCsv(
  filters: Omit<TransactionFilters, "limit" | "cursor">,
): Promise<void> {
  const accountsResponse = await mockApi.getAccounts();
  const accountNames = new Map(
    accountsResponse.accounts.map((account) => [account.id, account.name]),
  );

  const rows: string[] = [
    "date,name,merchant,amount,category,subCategory,account,type",
  ];
  let cursor: string | undefined;

  do {
    const page = await mockApi.getTransactions({
      ...filters,
      limit: 500,
      cursor,
    });
    for (const tx of page.items) {
      rows.push(
        formatCsvRow([
          tx.date,
          tx.name,
          tx.merchantName ?? "",
          tx.amount,
          tx.category,
          tx.subCategory ?? "",
          accountNames.get(tx.accountId) ?? tx.accountMask ?? "",
          tx.transactionType,
        ]),
      );
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  const filename = filters.month
    ? `transactions-${filters.month}.csv`
    : "transactions.csv";
  triggerBrowserDownload(
    new Blob([`${rows.join("\n")}\n`], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}

export const getSummary = api.getSummary.bind(api);
export const getTransactions = api.getTransactions.bind(api);
export const getAccounts = api.getAccounts.bind(api);
export const getAlerts = api.getAlerts.bind(api);
export const getCategories = api.getCategories.bind(api);
export const getMoneyFlow = api.getMoneyFlow.bind(api);
export const getTrends = api.getTrends.bind(api);
