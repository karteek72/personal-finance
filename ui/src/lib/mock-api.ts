import accountsData from "@/mocks/accounts.json";
import alertsData from "@/mocks/alerts.json";
import categoriesData from "@/mocks/categories.json";
import moneyFlowData from "@/mocks/money-flow.json";
import summaryData from "@/mocks/summary.json";
import transactionsData from "@/mocks/transactions.json";
import trendsData from "@/mocks/trends.json";
import netWorthData from "@/mocks/net-worth.json";
import investmentsData from "@/mocks/investments.json";
import budgetsData from "@/mocks/budgets.json";
import recurringData from "@/mocks/recurring.json";
import wellnessData from "@/mocks/wellness.json";
import dnaData from "@/mocks/dna.json";
import patternsData from "@/mocks/patterns.json";
import behavioralData from "@/mocks/behavioral.json";
import inflationData from "@/mocks/inflation.json";
import resilienceData from "@/mocks/resilience.json";
import fireData from "@/mocks/fire.json";
import coachData from "@/mocks/coach.json";
import wrappedData from "@/mocks/wrapped.json";
import merchantsData from "@/mocks/merchants.json";
import calendarData from "@/mocks/calendar.json";
import forecastData from "@/mocks/forecast.json";
import type {
  AccountsResponse,
  AlertsResponse,
  BehavioralResponse,
  BudgetsResponse,
  CalendarResponse,
  CategoriesResponse,
  ChartDataResponse,
  CoachResponse,
  CreditDebtSummary,
  DnaResponse,
  FireResponse,
  ForecastResponse,
  HouseholdInsightsResponse,
  HouseholdMember,
  HouseholdResponse,
  InflationResponse,
  InvestmentsResponse,
  MerchantsResponse,
  MoneyFlowResponse,
  NetWorthResponse,
  PaginatedTransactions,
  PatternsResponse,
  RecurringResponse,
  ResilienceResponse,
  TransactionFilters,
  TransactionSummary,
  TrendsResponse,
  UpdateTransactionCategoryResponse,
  WellnessResponse,
  WrappedResponse,
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

function normalizeMerchantKey(
  merchantName: string | null | undefined,
  name: string,
): string {
  return (merchantName?.trim() || name.trim()).toLowerCase().replace(/\s+/g, " ");
}

export async function updateTransactionCategory(
  transactionId: string,
  category: string,
  subCategory: string | null,
  rememberForMerchant: boolean,
): Promise<UpdateTransactionCategoryResponse> {
  await delay();
  const items = (transactionsData as PaginatedTransactions).items;
  const txn = items.find((row) => row.id === transactionId);
  if (!txn) {
    throw new Error("Transaction not found");
  }

  const merchantKey = normalizeMerchantKey(txn.merchantName, txn.name);
  let merchantTransactionsUpdated = 0;

  if (rememberForMerchant) {
    for (const row of items) {
      if (normalizeMerchantKey(row.merchantName, row.name) === merchantKey) {
        row.category = category;
        row.subCategory = subCategory;
        merchantTransactionsUpdated++;
      }
    }
  } else {
    txn.category = category;
    txn.subCategory = subCategory;
    merchantTransactionsUpdated = 1;
  }

  return {
    transaction: { id: transactionId, category, subCategory, merchantKey },
    merchantTransactionsUpdated,
  };
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

export async function getCreditDebtSummary(): Promise<CreditDebtSummary> {
  await delay();
  const data = accountsData as AccountsResponse;
  const cards = data.accounts
    .filter((account) => account.type === "credit")
    .map((account) => ({
      accountId: account.id,
      name: account.name,
      mask: account.mask,
      institutionName: account.institutionName,
      balanceCurrent: account.balanceCurrent,
      liability: account.liability ?? null,
    }));

  const num = (v: string | null | undefined): number =>
    v ? Number.parseFloat(v) : 0;
  const withLiability = cards.filter((c) => c.liability);

  return {
    totalCurrentBalance: cards
      .reduce((sum, card) => sum + Number.parseFloat(card.balanceCurrent), 0)
      .toFixed(2),
    totalStatementBalance: cards
      .reduce((s, c) => s + num(c.liability?.lastStatementBalance), 0)
      .toFixed(2),
    totalMinimumDue: cards
      .reduce((s, c) => s + num(c.liability?.minimumPaymentAmount), 0)
      .toFixed(2),
    totalEstimatedMonthlyInterest: cards
      .reduce((s, c) => s + num(c.liability?.estimatedMonthlyInterest), 0)
      .toFixed(2),
    overdueCount: cards.filter((c) => c.liability?.isOverdue).length,
    coverageLabel:
      withLiability.length === cards.length
        ? `Statement data for all ${cards.length} cards`
        : `Statement data for ${withLiability.length} of ${cards.length} cards`,
    cards,
  };
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
    bySubCategory: [],
    byAccount,
    byMember: byCategory.map((slice, index) => ({
      id: `mock-member-${index}`,
      name: index === 0 ? "Me" : `Member ${index + 1}`,
      color: ["#7c3aed", "#ec4899", "#14b8a6"][index % 3] ?? "#7c3aed",
      amount: slice.amount,
      percentage: slice.percentage,
    })),
    categoryTrends,
    totals: {
      expenses: expenseTotal.toFixed(2),
      income: incomeTotal.toFixed(2),
      net: (incomeTotal - expenseTotal).toFixed(2),
    },
  };
}

const mockHouseholdState: HouseholdResponse = {
  accessRole: "owner",
  household: {
    id: "mock-household",
    name: "My Family",
    createdAt: new Date().toISOString(),
  },
  members: [
    {
      id: "mock-member-owner",
      displayName: "Me",
      role: "owner",
      avatarColor: "#7c3aed",
      userId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "mock-member-partner",
      displayName: "Partner",
      role: "partner",
      avatarColor: "#ec4899",
      userId: null,
      createdAt: new Date().toISOString(),
    },
  ],
  accounts: (accountsData as AccountsResponse).accounts.map((account, index) => ({
    accountId: account.id,
    name: account.name,
    mask: account.mask ?? "0000",
    institutionName: account.institutionName,
    balanceCurrent: account.balanceCurrent,
    memberId: index % 2 === 0 ? "mock-member-owner" : "mock-member-partner",
    memberName: index % 2 === 0 ? "Me" : "Partner",
    memberColor: index % 2 === 0 ? "#7c3aed" : "#ec4899",
  })),
};

export async function getHousehold(): Promise<HouseholdResponse> {
  await delay();
  return mockHouseholdState;
}

export async function updateHouseholdName(name: string) {
  await delay();
  mockHouseholdState.household.name = name;
  return { id: mockHouseholdState.household.id, name };
}

export async function getHouseholdInsights(): Promise<HouseholdInsightsResponse> {
  await delay();
  const year = new Date().getFullYear();
  return {
    members: mockHouseholdState.members.map((member) => ({
      memberId: member.id,
      displayName: member.displayName,
      role: member.role,
      avatarColor: member.avatarColor,
      accountCount: mockHouseholdState.accounts.filter(
        (account) => account.memberId === member.id,
      ).length,
      totalSpent: "2450.00",
      totalIncome: "5200.00",
      topCategory: { name: "Food & Groceries", amount: "680.00" },
    })),
    unassignedAccounts: mockHouseholdState.accounts.filter(
      (account) => !account.memberId,
    ),
    householdTotals: {
      expenses: "4900.00",
      income: "10400.00",
      net: "5500.00",
    },
    period: { from: `${year}-01-01`, to: `${year}-12-31` },
  };
}

export async function createHouseholdMember(input: {
  displayName: string;
  role: "partner" | "child" | "other";
}): Promise<HouseholdMember> {
  await delay();
  const member: HouseholdMember = {
    id: `mock-member-${Date.now()}`,
    displayName: input.displayName,
    role: input.role,
    avatarColor: "#14b8a6",
    userId: null,
    createdAt: new Date().toISOString(),
  };
  mockHouseholdState.members.push(member);
  return member;
}

export async function updateHouseholdMember(
  memberId: string,
  input: { displayName?: string; role?: HouseholdMember["role"] },
): Promise<HouseholdMember> {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  if (!member) throw new Error("Member not found");
  if (input.displayName) member.displayName = input.displayName;
  if (input.role) member.role = input.role;
  return member;
}

export async function deleteHouseholdMember(memberId: string) {
  await delay();
  mockHouseholdState.members = mockHouseholdState.members.filter(
    (member) => member.id !== memberId,
  );
  mockHouseholdState.accounts = mockHouseholdState.accounts.map((account) =>
    account.memberId === memberId
      ? { ...account, memberId: null, memberName: null, memberColor: null }
      : account,
  );
  return { status: "deleted" };
}

export async function assignAccountToMember(
  accountId: string,
  memberId: string,
) {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  mockHouseholdState.accounts = mockHouseholdState.accounts.map((account) =>
    account.accountId === accountId
      ? {
          ...account,
          memberId,
          memberName: member?.displayName ?? null,
          memberColor: member?.avatarColor ?? null,
        }
      : account,
  );
  return { accountId, memberId };
}

export async function inviteHouseholdMember(
  memberId: string,
  email: string,
) {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  if (!member) throw new Error("Member not found");
  const inviteUrl = `http://localhost:3002/accept-invite?token=mock-invite-token`;
  member.pendingInvite = {
    id: "mock-invite",
    email: email.trim().toLowerCase(),
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: "pending",
  };
  return {
    invitationId: "mock-invite",
    inviteUrl,
    expiresAt: member.pendingInvite.expiresAt,
    email: member.pendingInvite.email,
  };
}

export async function revokeHouseholdInvite(memberId: string) {
  await delay();
  const member = mockHouseholdState.members.find((row) => row.id === memberId);
  if (member) member.pendingInvite = null;
  return { status: "revoked" };
}

export async function previewHouseholdInvite(token: string) {
  await delay();
  void token;
  return {
    householdName: mockHouseholdState.household.name,
    memberName: "Partner",
    memberRole: "partner",
    email: "partner@example.com",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    status: "pending" as const,
  };
}

export async function acceptHouseholdInvite(token: string) {
  await delay();
  void token;
  const partner = mockHouseholdState.members.find((m) => m.role === "partner");
  if (partner) partner.userId = "mock-partner-user";
  return {
    householdId: mockHouseholdState.household.id,
    householdName: mockHouseholdState.household.name,
    memberId: partner?.id ?? "mock-member-partner",
    memberDisplayName: partner?.displayName ?? "Partner",
  };
}

/* ------------------------------------------------------------------ *
 * Feature endpoints (demo dataset) — wealth, planning, insights,
 * protect, coach & wrapped. These mirror the backend /api/v1 routes.
 * ------------------------------------------------------------------ */

export async function getNetWorth(): Promise<NetWorthResponse> {
  await delay();
  return netWorthData as NetWorthResponse;
}

export async function getInvestments(): Promise<InvestmentsResponse> {
  await delay();
  return investmentsData as InvestmentsResponse;
}

export async function getBudgets(): Promise<BudgetsResponse> {
  await delay();
  return budgetsData as BudgetsResponse;
}

export async function getRecurring(): Promise<RecurringResponse> {
  await delay();
  return recurringData as RecurringResponse;
}

export async function getFire(): Promise<FireResponse> {
  await delay();
  return fireData as FireResponse;
}

export async function getWellness(): Promise<WellnessResponse> {
  await delay();
  return wellnessData as WellnessResponse;
}

export async function getDna(): Promise<DnaResponse> {
  await delay();
  return dnaData as DnaResponse;
}

export async function getPatterns(): Promise<PatternsResponse> {
  await delay();
  return patternsData as PatternsResponse;
}

export async function getBehavioral(): Promise<BehavioralResponse> {
  await delay();
  return behavioralData as BehavioralResponse;
}

export async function getInflation(): Promise<InflationResponse> {
  await delay();
  return inflationData as InflationResponse;
}

export async function getResilience(): Promise<ResilienceResponse> {
  await delay();
  return resilienceData as ResilienceResponse;
}

export async function getCoach(): Promise<CoachResponse> {
  await delay();
  return coachData as CoachResponse;
}

export async function getWrapped(): Promise<WrappedResponse> {
  await delay();
  return wrappedData as WrappedResponse;
}

export async function getMerchants(): Promise<MerchantsResponse> {
  await delay();
  return merchantsData as MerchantsResponse;
}

export async function getCalendar(): Promise<CalendarResponse> {
  await delay();
  return calendarData as CalendarResponse;
}

export async function getForecast(): Promise<ForecastResponse> {
  await delay();
  return forecastData as ForecastResponse;
}
