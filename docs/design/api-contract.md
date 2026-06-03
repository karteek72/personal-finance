# API Contract

**Version:** 1.0  
**Base URL (dev):** `http://localhost:4000/api/v1`  
**Base URL (prod):** `https://api.spendflow.local/api/v1` (configurable)

Shared contract between `ui/` and `backend/`. Backend implements; UI consumes via typed client. Breaking changes require a version bump and dated note here.

---

## Conventions

| Topic | Rule |
|-------|------|
| Format | JSON request/response bodies |
| Auth | `Authorization: Bearer <jwt>` on protected routes |
| Errors | `{ "error": { "code": string, "message": string, "details"?: unknown } }` |
| Pagination | Cursor-based: `?limit=50&cursor=<opaque>` → `{ items, nextCursor }` |
| Dates | ISO 8601 (`YYYY-MM-DD` for transaction dates) |
| Money | Decimal strings with 2 places in JSON (e.g. `"127.43"`) — avoid float |
| IDs | UUID v4 |

HTTP status codes: `200` success, `201` created, `204` no content, `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `429` rate limit, `500` server error.

---

## Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/google` | `{ idToken }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/register` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | — | `204` |
| GET | `/auth/me` | — | `{ user }` |
| DELETE | `/users/me` | — | `204` (CCPA cascade delete) |

---

## Plaid

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/plaid/link-token` | `{ platform?: "web" \| "ios" }` | `{ linkToken }` |
| POST | `/plaid/exchange-token` | `{ publicToken }` | `{ itemId, institutionName }` |
| GET | `/plaid/accounts` | — | `{ accounts: Account[] }` |
| DELETE | `/plaid/items/:itemId` | — | `204` |
| POST | `/plaid/items/:itemId/sync` | — | `{ status: "queued" }` |

### Liabilities (credit cards)

| Method | Path | Response |
|--------|------|----------|
| GET | `/liabilities/summary` | `CreditDebtSummary` — statement balance, minimum due, due dates, APRs per card |

Requires `PLAID_PRODUCTS=transactions,liabilities`. Existing items must be re-linked to grant the Liabilities product.

**Webhook (Plaid → backend, not UI):**

| Method | Path | Notes |
|--------|------|-------|
| POST | `/webhooks/plaid` | HMAC verified; no auth header |

---

## Transactions

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/transactions` | `month`, `category`, `subCategory`, `accountId`, `memberId`, `scope` (`all`\|`household`\|`personal`), `q`, `type`, `sort` (`date_desc`\|`date_asc`\|`amount_desc`\|`amount_asc`), `limit`, `cursor` | `{ items: Transaction[], nextCursor }` |
| GET | `/transactions/summary` | `from`, `to` | `TransactionSummary` |
| GET | `/transactions/by-category` | `from`, `to` | `{ categories: CategoryTotal[] }` |
| GET | `/transactions/chart-data` | `from`, `to`, `category`, `accountId` | `ChartDataResponse` (monthly series + category breakdown) |
| GET | `/transactions/flow` | `from`, `to` | `MoneyFlowResponse` |
| PATCH | `/transactions/:id/category` | `{ category, rememberForMerchant? }` | `{ transaction, merchantTransactionsUpdated }` |
| GET | `/transactions/category-options` | — | `{ categories: string[] }` |
| GET | `/transactions/export.csv` | same as list filters | `text/csv` stream |

---

## Accounts

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/accounts` | — | `{ accounts: Account[] }` (includes liability detail when available) |
| DELETE | `/accounts/:accountId` | — | `{ deleted: true }` |
| POST | `/accounts/:accountId/sync` | — | `{ status: "queued" }` |
| POST | `/plaid/sync` | — | `{ queued: number }` (sync all items) |

---

## Insights

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/insights/alerts` | `month` | `{ alerts: Alert[] }` |
| GET | `/insights/trends` | `from`, `to` | `{ trends: CategoryTrend[] }` |
| GET | `/insights/subscriptions` | — | `{ subscriptions: Subscription[] }` (V2) |

### Insights — advanced (V2)

Backed by the demo dataset (Drizzle tables + derived rollups). All scoped to the household.

| Method | Path | Response |
|--------|------|----------|
| GET | `/insights/wellness` | `WellnessResponse` — composite score, dimensions, history |
| GET | `/insights/dna` | `DnaResponse` — archetype, narrative, axes, peer rarity (`404` if none) |
| GET | `/insights/patterns` | `PatternsResponse` — day-of-week averages + detected patterns |
| GET | `/insights/behavioral` | `BehavioralResponse` — challenges, streaks, spending/income creep, reasons |
| GET | `/insights/merchants` | `MerchantsResponse` — top/most-visited/fastest-growing merchants, income insights (`isLive` when computed from synced transactions) |

---

## Wealth

| Method | Path | Response |
|--------|------|----------|
| GET | `/wealth/net-worth` | `NetWorthResponse` — current totals + monthly snapshot trend + asset/liability breakdown |
| GET | `/wealth/investments` | `InvestmentsResponse` — holdings, securities, allocation, behavioral alerts |
| GET | `/wealth/fire` | `FireResponse` — age, net worth, monthly spend/invest, withdrawal rate, real return (`404` if no profile) |

---

## Planning

| Method | Path | Response |
|--------|------|----------|
| GET | `/planning/budgets` | `BudgetsResponse` — per-category budget vs spend, savings goals, safe-to-spend |
| GET | `/planning/recurring` | `RecurringResponse` — subscriptions, bills, price changes, leak fees + lifestyle habits |
| GET | `/planning/calendar` | `CalendarResponse` — month events (bills/subscriptions/income), spend heatmap, safe-to-spend today (derived) |
| GET | `/planning/forecast` | `ForecastResponse` — 14-day cash-flow projection with weather, comfort floor, recommendation (derived) |

---

## Protect

| Method | Path | Response |
|--------|------|----------|
| GET | `/protect/inflation` | `InflationResponse` — personal vs national rate, power loss, category basket |
| GET | `/protect/resilience` | `ResilienceResponse` — liquid cash, monthly burn, shock scenarios + runway scores |

---

## Coach & Wrapped

| Method | Path | Response |
|--------|------|----------|
| GET | `/coach/insights` | `CoachResponse` — monthly narrative, Q&A pairs, 30-day forecast text |
| POST | `/coach/ask` | `{ question: string }` → `{ answer: string, isLive: boolean }` — rule-based answers from transaction summaries (no LLM) |
| GET | `/wrapped` | `WrappedResponse` — year-in-review totals, archetype, top category, moments |

---

## Devices (mobile)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/devices` | `{ apnsToken, platform: "ios" }` | `{ device }` |
| DELETE | `/devices/:deviceId` | — | `204` |

---

## Health

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{ status: "ok", version, db, redis }` |

---

## Core types (TypeScript reference)

These types will live in `backend/src/types/` and be mirrored or imported in `ui/src/types/api.ts`.

```typescript
interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface Account {
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
}

interface Transaction {
  id: string;
  accountId: string;
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

interface TransactionSummary {
  totalSpent: string;
  income: string;
  netSavings: string;
  avgMonthlySpend: string;
  topCategory: { name: string; amount: string };
  ccPaymentsExcluded: string;
  savingsRate: number;
}

interface MoneyFlowResponse {
  income: { sources: FlowLine[]; total: string };
  bankAccounts: { accounts: FlowLine[]; transfersOut: string };
  creditCards: { accounts: FlowLine[]; totalCharges: string };
  monthlySeries: { month: string; income: string; expenses: string; net: string }[];
}

interface FlowLine {
  label: string;
  amount: string;
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  dismissible: boolean;
}
```

---

## Household & partner invites

Multi-user households: owner invites partners by email; partner signs in with Google and accepts. Dashboard/transactions aggregate all linked members' data.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/household` | Bearer | Returns `accessRole` (`owner` \| `member`), members, accounts |
| PATCH | `/household` | Owner | Body `{ name }` → updated household |
| GET | `/household/insights` | Bearer | Household-level spend/income rollups |
| POST | `/household/members` | Owner | Body `{ name, relationship?, … }` → `HouseholdMember` |
| PATCH | `/household/members/:memberId` | Owner | Update member fields → `HouseholdMember` |
| DELETE | `/household/members/:memberId` | Owner | `204` |
| PUT | `/household/accounts/:accountId/assign` | Owner | Body `{ memberId }` → `{ accountId, memberId }` |
| POST | `/household/members/:memberId/invite` | Owner | Body `{ email }` → `{ inviteUrl, expiresAt, … }` |
| DELETE | `/household/members/:memberId/invite` | Owner | Revoke pending invite |
| GET | `/household/invites/preview?token=` | Public | Invite metadata before sign-in |
| POST | `/household/invites/accept` | Bearer | Body `{ token }`; email must match signed-in user |

Partners link banks on **Accounts** (their own Plaid items). Owner can still link banks and assign accounts on **Family**.

---

## CORS (web client only)

CORS applies to the browser (`ui/`) only. Native iOS clients use Bearer tokens over HTTPS — no CORS.

Backend allows origins:

- Dev: `http://localhost:3000`
- Prod: `https://spendflow.local` (or env `CORS_ORIGIN`)

Credentials: `true` (if cookie auth) or Bearer-only.

---

## Rate limiting

100 requests/minute per authenticated user. Response header: `Retry-After` on `429`.
