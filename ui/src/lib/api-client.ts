import * as mockApi from "@/lib/mock-api";
import { normalizeSavingsRate } from "@/lib/savings-rate";
import { getAccessToken } from "@/lib/auth-session";
import type {
  AuthRefreshResponse,
  AuthSessionResponse,
  AccountsResponse,
  AlertsResponse,
  BehavioralResponse,
  BudgetsResponse,
  BudgetRow,
  CreateGoalInput,
  GoalRow,
  PatchBudgetInput,
  PatchGoalInput,
  UpsertBudgetInput,
  CalendarResponse,
  CategoriesResponse,
  ChartDataFilters,
  ChartDataResponse,
  CoachResponse,
  CoachAskResponse,
  CreditDebtSummary,
  DeleteAccountResponse,
  DnaResponse,
  FireQueryOverrides,
  FireResponse,
  UserProfileResponse,
  UserProfilePatch,
  AnalyticsProfileResponse,
  FireProfilePatch,
  ForecastResponse,
  HouseholdInsightsResponse,
  HouseholdInviteAcceptResponse,
  HouseholdInvitePreview,
  HouseholdInviteResponse,
  HouseholdMember,
  HouseholdResponse,
  InflationResponse,
  InvestmentsResponse,
  ListQuery,
  MerchantsResponse,
  MerchantsTableResponse,
  MoneyFlowResponse,
  NetWorthResponse,
  PaginatedTransactions,
  PatternsResponse,
  ConnectionProvidersResponse,
  PlaidExchangeResponse,
  SnaptradeCompleteResponse,
  SnaptradePortalResponse,
  TellerConnectConfig,
  TellerExchangeResponse,
  PlaidItemsResponse,
  PlaidSyncAllResponse,
  PlaidSyncResponse,
  RecurringResponse,
  RecomputeAnalyticsResponse,
  ResilienceResponse,
  TransactionFilters,
  TransactionReasonResponse,
  TransactionSummary,
  TrendsResponse,
  UpdateTransactionCategoryResponse,
  WellnessResponse,
  WrappedResponse,
  ImportFormatsResponse,
  ImportActiveBatchResponse,
  ImportBatchCreateResponse,
  ImportBatchStatusResponse,
  ImportConfirmResponse,
} from "@/types/api";

/** Thrown when import upload/status API returns an error body. */
export class ImportApiError extends Error {
  readonly status: number;
  readonly activeBatchId?: string;

  constructor(
    message: string,
    status: number,
    details?: { activeBatchId?: string },
  ) {
    super(message);
    this.name = "ImportApiError";
    this.status = status;
    this.activeBatchId = details?.activeBatchId;
  }
}

function parseImportErrorBody(
  body: unknown,
  status: number,
): ImportApiError {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { message?: string; details?: { activeBatchId?: string } } })
      .error?.message === "string"
  ) {
    const err = (body as {
      error: { message: string; details?: { activeBatchId?: string } };
    }).error;
    return new ImportApiError(err.message, status, err.details);
  }
  return new ImportApiError(`Request failed (${status})`, status);
}

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

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
    let message = `Request failed with status ${response.status}`;
    if (typeof body === "object" && body !== null) {
      const nested = (body as { error?: { message?: string } }).error?.message;
      const topLevel = (body as { message?: string }).message;
      if (typeof nested === "string" && nested.length > 0) {
        message = nested;
      } else if (typeof topLevel === "string" && topLevel.length > 0) {
        message = topLevel;
      }
      const details = (body as { error?: { details?: unknown } }).error?.details;
      if (details && typeof details === "object" && message === "Invalid request body") {
        const fieldSummary = Object.entries(details as Record<string, unknown>)
          .flatMap(([field, errs]) =>
            Array.isArray(errs)
              ? errs.map((e) => `${field}: ${String(e)}`)
              : [],
          )
          .join("; ");
        if (fieldSummary) {
          message = fieldSummary;
        }
      }
    }
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

  getMe(): Promise<{ user: AuthSessionResponse["user"] }> {
    return fetchJson<{ user: AuthSessionResponse["user"] }>("/auth/me");
  },

  getSummary(from?: string, to?: string): Promise<TransactionSummary> {
    if (USE_MOCKS) {
      return mockApi.getSummary(from, to);
    }
    return fetchJson<TransactionSummary>(
      `/transactions/summary${buildQuery({ from, to })}`,
    ).then((summary) => ({
      ...summary,
      savingsRate: normalizeSavingsRate(summary.savingsRate),
    }));
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

  async exportUserDataJson(): Promise<void> {
    if (USE_MOCKS) {
      triggerBrowserDownload(
        new Blob(
          [JSON.stringify({ exportVersion: "1.0", exportedAt: new Date().toISOString() }, null, 2)],
          { type: "application/json" },
        ),
        "spendflow-export-mock.json",
      );
      return;
    }

    const response = await fetch(`${getBaseUrl()}/auth/export`, {
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
      ) ?? "spendflow-export.json";
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

  getConnectionProviders(): Promise<ConnectionProvidersResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        providers: [
          {
            id: "plaid",
            label: "Plaid",
            description: "Banks and credit cards",
            accountTypes: ["depository", "credit", "investment"],
            enabled: true,
          },
          {
            id: "teller",
            label: "Teller",
            description: "Checking and credit cards",
            accountTypes: ["depository", "credit"],
            enabled: true,
          },
          {
            id: "snaptrade",
            label: "SnapTrade",
            description: "Brokerage accounts",
            accountTypes: ["investment"],
            enabled: true,
          },
        ],
      });
    }
    return fetchJson<ConnectionProvidersResponse>("/connections/providers");
  },

  getTellerConfig(): Promise<TellerConnectConfig> {
    if (USE_MOCKS) {
      return Promise.resolve({
        applicationId: "app_mock",
        environment: "sandbox",
        products: ["transactions", "balance"],
      });
    }
    return fetchJson<TellerConnectConfig>("/teller/config");
  },

  exchangeTellerToken(body: {
    accessToken: string;
    enrollmentId: string;
    institutionName?: string;
  }): Promise<TellerExchangeResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        enrollmentId: "enr_mock",
        institutionName: body.institutionName ?? "Mock Bank",
        accountsSynced: 1,
        transactionsAdded: 0,
        message: "Mock Teller exchange complete",
      });
    }
    return fetchJson<TellerExchangeResponse>("/teller/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  createSnaptradePortalUrl(options?: {
    broker?: string;
    reconnectAuthorizationId?: string;
  }): Promise<SnaptradePortalResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({ redirectUri: "about:blank" });
    }
    return fetchJson<SnaptradePortalResponse>("/snaptrade/portal-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options ?? {}),
    });
  },

  completeSnaptradeConnection(): Promise<SnaptradeCompleteResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        status: "completed",
        connectionsSynced: 1,
        accountsSynced: 1,
        holdingsUpdated: 0,
        activitiesAdded: 0,
        message: "Mock SnapTrade sync complete",
      });
    }
    return fetchJson<SnaptradeCompleteResponse>("/snaptrade/complete", {
      method: "POST",
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

  getInvestments(params: ListQuery & { accountId?: string } = {}): Promise<InvestmentsResponse> {
    if (USE_MOCKS) return mockApi.getInvestments(params);
    return fetchJson<InvestmentsResponse>(
      `/wealth/investments${buildQuery({ ...params })}`,
    );
  },

  getFire(overrides: FireQueryOverrides = {}): Promise<FireResponse> {
    if (USE_MOCKS) return mockApi.getFire(overrides);
    return fetchJson<FireResponse>(
      `/wealth/fire${buildQuery({ ...overrides })}`,
    );
  },

  patchFire(patch: FireProfilePatch): Promise<FireResponse> {
    if (USE_MOCKS) return mockApi.patchFire(patch);
    return fetchJson<FireResponse>("/wealth/fire", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  },

  getAnalyticsProfile(): Promise<AnalyticsProfileResponse> {
    if (USE_MOCKS) return mockApi.getAnalyticsProfile();
    return fetchJson<AnalyticsProfileResponse>("/user/analytics-profile");
  },

  getUserProfile(): Promise<UserProfileResponse> {
    if (USE_MOCKS) return mockApi.getUserProfile();
    return fetchJson<UserProfileResponse>("/user/profile");
  },

  patchUserProfile(patch: UserProfilePatch): Promise<UserProfileResponse> {
    if (USE_MOCKS) return mockApi.patchUserProfile(patch);
    return fetchJson<UserProfileResponse>("/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  },

  patchAnalyticsProfile(
    patch: FireProfilePatch,
  ): Promise<AnalyticsProfileResponse> {
    if (USE_MOCKS) return mockApi.patchAnalyticsProfile(patch);
    return fetchJson<AnalyticsProfileResponse>("/user/analytics-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  },

  getImportFormats(): Promise<ImportFormatsResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        formats: [
          {
            id: "qfx_ofx",
            label: "QFX / OFX",
            extensions: [".qfx", ".ofx"],
            description: "Bank, credit, and brokerage exports.",
            brokers: ["Fidelity"],
          },
          {
            id: "csv",
            label: "CSV",
            extensions: [".csv"],
            description: "Broker activity exports.",
            brokers: ["E*TRADE", "Fidelity", "Webull"],
          },
          {
            id: "pdf",
            label: "PDF",
            extensions: [".pdf"],
            description: "Monthly statements.",
            brokers: ["SoFi Invest"],
          },
        ],
        limits: {
          maxFiles: 12,
          maxFileBytes: 10 * 1024 * 1024,
          maxBatchBytes: 120 * 1024 * 1024,
        },
        consentVersion: "statement_import_v1",
      });
    }
    return fetchJson<ImportFormatsResponse>("/imports/formats");
  },

  getActiveImportBatch(): Promise<ImportActiveBatchResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({ activeBatchId: null });
    }
    return fetchJson<ImportActiveBatchResponse>("/imports/batches/active");
  },

  async uploadImportBatch(
    files: File[],
    consentAccepted: boolean,
  ): Promise<ImportBatchCreateResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        batchId: "mock-batch-id",
        status: "pending",
        filesTotal: files.length,
        message: "Mock upload received.",
      });
    }
    const form = new FormData();
    form.set("consentAccepted", consentAccepted ? "true" : "false");
    for (const file of files) {
      form.append("files", file);
    }
    const response = await fetch(`${getBaseUrl()}/imports/batches`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw parseImportErrorBody(body, response.status);
    }
    return response.json() as Promise<ImportBatchCreateResponse>;
  },

  getImportBatch(batchId: string): Promise<ImportBatchStatusResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        batch: {
          id: batchId,
          status: "pending",
          filesTotal: 1,
          filesProcessed: 0,
          txnsInserted: 0,
          txnsSkipped: 0,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
        summary: {
          total: 1,
          pending: 1,
          ready: 0,
          failed: 0,
          imported: 0,
          bankingTransactions: 0,
          investmentTransactions: 0,
          canRetryFailed: false,
          canConfirm: false,
        },
        files: [],
      });
    }
    return fetchJson<ImportBatchStatusResponse>(`/imports/batches/${batchId}`);
  },

  confirmImportBatch(
    batchId: string,
    options?: {
      accountMappings?: Record<string, string>;
      fileIds?: string[];
    },
  ): Promise<ImportConfirmResponse> {
    if (USE_MOCKS) {
      return Promise.resolve({
        batchId,
        status: "completed",
        txnsInserted: 42,
        txnsSkipped: 3,
        filesImported: 1,
        message: "Mock import confirmed.",
      });
    }
    return fetchJson<ImportConfirmResponse>(`/imports/batches/${batchId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(options ?? {}),
    });
  },

  retryFailedImportFiles(batchId: string): Promise<{ batchId: string; retried: number; message: string }> {
    if (USE_MOCKS) {
      return Promise.resolve({ batchId, retried: 1, message: "Mock retry." });
    }
    return fetchJson(`/imports/batches/${batchId}/retry-failed`, {
      method: "POST",
      headers: authHeaders(),
    });
  },

  retryImportFile(
    batchId: string,
    fileId: string,
  ): Promise<{ batchId: string; fileId: string; message: string }> {
    if (USE_MOCKS) {
      return Promise.resolve({ batchId, fileId, message: "Mock retry." });
    }
    return fetchJson(`/imports/batches/${batchId}/files/${fileId}/retry`, {
      method: "POST",
      headers: authHeaders(),
    });
  },

  async replaceImportFile(
    batchId: string,
    fileId: string,
    file: File,
  ): Promise<{ batchId: string; fileId: string; message: string }> {
    if (USE_MOCKS) {
      return Promise.resolve({ batchId, fileId, message: "Mock replace." });
    }
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(
      `${getBaseUrl()}/imports/batches/${batchId}/files/${fileId}/replace`,
      {
        method: "POST",
        headers: authHeaders(),
        body: form,
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(body?.error?.message ?? `Replace failed (${response.status})`);
    }
    return response.json() as Promise<{ batchId: string; fileId: string; message: string }>;
  },

  cancelImportBatch(batchId: string): Promise<void> {
    if (USE_MOCKS) {
      return Promise.resolve();
    }
    return fetch(`${getBaseUrl()}/imports/batches/${batchId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then((response) => {
      if (!response.ok && response.status !== 204) {
        throw new Error("Could not cancel import.");
      }
    });
  },

  getBudgets(): Promise<BudgetsResponse> {
    if (USE_MOCKS) return mockApi.getBudgets();
    return fetchJson<BudgetsResponse>("/planning/budgets");
  },

  upsertBudget(body: UpsertBudgetInput): Promise<BudgetRow> {
    if (USE_MOCKS) return mockApi.upsertBudget(body);
    return fetchJson<BudgetRow>("/planning/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  patchBudget(budgetId: string, body: PatchBudgetInput): Promise<BudgetRow> {
    if (USE_MOCKS) return mockApi.patchBudget(budgetId, body);
    return fetchJson<BudgetRow>(`/planning/budgets/${budgetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  deleteBudget(budgetId: string): Promise<{ id: string }> {
    if (USE_MOCKS) return mockApi.deleteBudget(budgetId);
    return fetchJson<{ id: string }>(`/planning/budgets/${budgetId}`, {
      method: "DELETE",
    });
  },

  createGoal(body: CreateGoalInput): Promise<GoalRow> {
    if (USE_MOCKS) return mockApi.createGoal(body);
    return fetchJson<GoalRow>("/planning/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  patchGoal(goalId: string, body: PatchGoalInput): Promise<GoalRow> {
    if (USE_MOCKS) return mockApi.patchGoal(goalId, body);
    return fetchJson<GoalRow>(`/planning/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  deleteGoal(goalId: string): Promise<{ id: string }> {
    if (USE_MOCKS) return mockApi.deleteGoal(goalId);
    return fetchJson<{ id: string }>(`/planning/goals/${goalId}`, {
      method: "DELETE",
    });
  },

  getRecurring(params: ListQuery = {}): Promise<RecurringResponse> {
    if (USE_MOCKS) return mockApi.getRecurring(params);
    return fetchJson<RecurringResponse>(
      `/planning/recurring${buildQuery({ ...params })}`,
    );
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

  setTransactionReason(
    transactionId: string,
    reasonId: string,
  ): Promise<TransactionReasonResponse> {
    if (USE_MOCKS) {
      return mockApi.setTransactionReason(transactionId, reasonId);
    }
    return fetchJson<TransactionReasonResponse>(
      `/transactions/${transactionId}/reason`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonId }),
      },
    );
  },

  clearTransactionReason(
    transactionId: string,
  ): Promise<TransactionReasonResponse> {
    if (USE_MOCKS) {
      return mockApi.clearTransactionReason(transactionId);
    }
    return fetchJson<TransactionReasonResponse>(
      `/transactions/${transactionId}/reason`,
      { method: "DELETE" },
    );
  },

  recomputeAnalytics(): Promise<RecomputeAnalyticsResponse> {
    if (USE_MOCKS) {
      return mockApi.recomputeAnalytics();
    }
    return fetchJson<RecomputeAnalyticsResponse>("/analytics/recompute", {
      method: "POST",
    });
  },

  getMerchants(): Promise<MerchantsResponse> {
    if (USE_MOCKS) return mockApi.getMerchants();
    return fetchJson<MerchantsResponse>("/insights/merchants");
  },

  getMerchantsTable(params: ListQuery = {}): Promise<MerchantsTableResponse> {
    if (USE_MOCKS) return mockApi.getMerchantsTable(params);
    return fetchJson<MerchantsTableResponse>(
      `/analytics/merchants${buildQuery({ ...params })}`,
    );
  },

  getInflation(params: ListQuery = {}): Promise<InflationResponse> {
    if (USE_MOCKS) return mockApi.getInflation(params);
    return fetchJson<InflationResponse>(
      `/protect/inflation${buildQuery({ ...params })}`,
    );
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
    return fetchJson<WrappedResponse>("/wrapped").then((wrapped) => ({
      ...wrapped,
      savingsRate: normalizeSavingsRate(wrapped.savingsRate),
    }));
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
