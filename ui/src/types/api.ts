export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  officialName: string | null;
  type: "depository" | "credit" | "investment";
  subtype: string | null;
  mask: string | null;
  balanceCurrent: string;
  balanceAvailable: string | null;
  currencyCode: string;
  institutionName: string;
  lastSyncedAt: string | null;
  status: "active" | "error" | "reauth_required";
  source?: "import" | "plaid";
  plaidItemId?: string | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  accountMask: string | null;
  date: string;
  name: string;
  merchantName: string | null;
  amount: string;
  currencyCode: string;
  category: string;
  transactionType: "expense" | "income" | "transfer";
  isTransfer: boolean;
  pending: boolean;
}

export interface TransactionSummary {
  totalSpent: string;
  income: string;
  netSavings: string;
  avgMonthlySpend: string;
  topCategory: { name: string; amount: string };
  ccPaymentsExcluded: string;
  savingsRate: number;
}

export interface FlowLine {
  label: string;
  amount: string;
}

export interface MoneyFlowResponse {
  income: { sources: FlowLine[]; total: string };
  bankAccounts: { accounts: FlowLine[]; transfersOut: string };
  creditCards: { accounts: FlowLine[]; totalCharges: string };
  monthlySeries: {
    month: string;
    income: string;
    expenses: string;
    net: string;
  }[];
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  dismissible: boolean;
}

export interface CategoryTotal {
  name: string;
  amount: string;
  percentage: number;
  deltaVsPriorMonth: number;
}

export interface CategoryTrend {
  name: string;
  months: { month: string; amount: string }[];
}

export interface PlaidExchangeResponse {
  itemId: string;
  institutionName: string;
  accountsSynced: number;
  transactionsAdded: number;
  message: string;
}

export interface PlaidItem {
  id: string;
  plaidItemId: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface PlaidItemsResponse {
  items: PlaidItem[];
}

export interface PlaidSyncResponse {
  status: string;
  itemId: string;
  institutionName: string;
  accountsSynced: number;
  added: number;
  modified: number;
  removed: number;
}

export interface PlaidSyncAllResponse {
  status: string;
  itemsSynced: number;
  added: number;
  modified: number;
  removed: number;
}

export interface PaginatedTransactions {
  items: Transaction[];
  nextCursor: string | null;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface DeleteAccountResponse {
  id: string;
  name: string;
  mask: string;
  transactionsDeleted: number;
}

export interface AlertsResponse {
  alerts: Alert[];
}

export interface CategoriesResponse {
  categories: CategoryTotal[];
}

export interface TrendsResponse {
  trends: CategoryTrend[];
}

export interface TransactionFilters {
  month?: string;
  category?: string;
  accountId?: string;
  q?: string;
  type?: Transaction["transactionType"];
  sort?:
    | "date_desc"
    | "date_asc"
    | "amount_desc"
    | "amount_asc"
    | "name_asc"
    | "name_desc"
    | "category_asc";
  limit?: number;
  cursor?: string;
}
