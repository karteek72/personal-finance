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
| Pagination | **Two patterns:** (1) cursor for high-volume feeds — `?limit=50&cursor=<opaque>` → `{ items, nextCursor }` (transactions list); (2) offset for tabular reports — `ListQuery` → `Page<T>` (see [List & pagination](#list--pagination)) |
| Dates | ISO 8601 (`YYYY-MM-DD` for transaction dates) |
| Money | Decimal strings with 2 places in JSON (e.g. `"127.43"`) — avoid float |
| IDs | UUID v4 |

HTTP status codes: `200` success, `201` created, `204` no content, `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `429` rate limit, `500` server error.

---

## List & pagination

Tabular report endpoints (merchants, category breakdowns, holdings, subscriptions, money-flow sources, etc.) use a **uniform offset contract** with a total count. High-volume append-only feeds (the transactions list) keep **cursor/infinite-scroll** pagination.

**Thin-client rule:** sort, filter, rank, truncate, and row-level math happen server-side. Clients render `rows` as received — no recomputing totals, percentages, P/L, or trends in the UI.

### Request — `ListQuery`

Query params (all optional unless noted):

| Param | Type | Default | Rule |
|-------|------|---------|------|
| `page` | int | `1` | 1-based page index |
| `pageSize` | int | `25` | Range `[1, 200]` |
| `sort` | string | endpoint default | **Server-whitelisted column** — any other value → `400` |
| `dir` | `asc` \| `desc` | endpoint default | Sort direction |
| `q` | string | — | Free-text filter (fields defined per endpoint) |
| `from` | `YYYY-MM-DD` | — | Inclusive date window start |
| `to` | `YYYY-MM-DD` | — | Inclusive date window end |
| *facets* | varies | — | Endpoint-specific filters (`category`, `accountId`, …) |

Example: `GET /analytics/merchants?page=2&pageSize=25&sort=total&dir=desc&q=starbucks&from=2026-01-01&to=2026-06-30`

### Response — `Page<T>`

```jsonc
{
  "rows": [ /* fully-computed row objects; money as 2-dp strings */ ],
  "page": 2,
  "pageSize": 25,
  "total": 184,
  "totalPages": 8,
  "sort": "total",
  "dir": "desc",
  "appliedFilters": { "q": "starbucks", "from": "2026-01-01", "to": "2026-06-30" }
}
```

- `total` = row count **after** facet/`q` filters, before paging — drives page controls.
- Each row includes server-computed totals, shares, trends, and rank metadata.
- Invalid `sort` → `400` with allowed values in `details`. Query validated with Zod on the backend.

### Shared type locations

| Location | Purpose |
|----------|---------|
| `backend/src/lib/list-query.ts` | Zod schema (`parseListQuery`), `Page<T>`, `ParsedListQuery`, `buildPage()` |
| `ui/src/types/api.ts` | `ListQuery`, `Page<TRow>` — mirror for the typed API client |

Per-endpoint sort whitelists are exported next to each service (e.g. `MERCHANT_SORTABLE` in `analytics-merchants.ts`).

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
| GET | `/auth/export` | — | Portable JSON download (`Content-Disposition: attachment`). No secrets (Plaid tokens, encrypted import blobs, invitation tokens). Logs `data_export` audit event. |
| DELETE | `/users/me` | — | `204` (CCPA cascade delete) |

---

## Account connections

Users choose a provider when linking accounts. The UI calls `GET /connections/providers` to see which integrations are enabled server-side.

| Method | Path | Response |
|--------|------|----------|
| GET | `/connections/providers` | `{ providers: ConnectionProvider[] }` — `id`: `plaid` \| `teller` \| `snaptrade`, `enabled`, `accountTypes` |

`Account.source` and `Account.connectionProvider`: `import` \| `plaid` \| `teller` \| `snaptrade`.

---

## Teller (banking & credit cards)

Teller Connect runs in the browser; the UI exchanges the enrollment `accessToken` on the backend. API calls use mTLS client certificates in `development`/`production` (`TELLER_CERT_PATH`, `TELLER_KEY_PATH`); sandbox does not require certs.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/teller/config` | — | `{ applicationId, environment, products }` for Teller Connect |
| POST | `/teller/exchange` | `{ accessToken, enrollmentId, institutionName? }` | `{ enrollmentId, institutionName, accountsSynced, transactionsAdded, message }` |
| GET | `/teller/enrollments` | — | `{ items }` |
| POST | `/teller/enrollments/:enrollmentId/sync` | — | sync result |
| DELETE | `/teller/enrollments/:enrollmentId` | — | `204` |

---

## SnapTrade (brokerage)

Connection Portal URL is generated server-side; after the user finishes linking, call `POST /snaptrade/complete` (or open `/accounts/snaptrade/callback` with `SNAPTRADE_REDIRECT_URI`).

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/snaptrade/portal-url` | `{ broker?, reconnectAuthorizationId? }` | `{ redirectUri }` |
| POST | `/snaptrade/complete` | — | `{ status, connectionsSynced, accountsSynced, holdingsUpdated, activitiesAdded, message }` |
| POST | `/snaptrade/sync` | — | `202` — background sync all SnapTrade connections |

---

## Plaid

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/plaid/link-token` | `{ platform?: "web" \| "ios" }` | `{ linkToken }` |
| POST | `/plaid/exchange-token` | `{ publicToken }` | `{ itemId, institutionName }` |
| GET | `/plaid/accounts` | — | `{ accounts: Account[] }` |
| DELETE | `/plaid/items/:itemId` | — | `204` — Plaid `itemRemove` plus delete of all accounts and transactions on that item |
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
| GET | `/transactions` | `month`, `category`, `subCategory`, `categorizationStatus` (`uncategorized`\|`missing_subcategory`\|`needs_review`), `accountId`, `memberId`, `scope` (`all`\|`household`\|`personal`), `q`, `type`, `sort` (`date_desc`\|`date_asc`\|`amount_desc`\|`amount_asc`), `limit`, `cursor` | `{ items: Transaction[], nextCursor }` |
| GET | `/transactions/summary` | `from`, `to` | `TransactionSummary` |
| GET | `/transactions/by-category` | `from`, `to` | `{ categories: CategoryTotal[] }` |
| GET | `/transactions/chart-data` | `from`, `to`, `category`, `accountId` | `ChartDataResponse` — `monthly` (filtered by `from`/`to`), `yearly` (full history when data spans 2+ calendar years), category breakdown |
| GET | `/transactions/flow` | `from`, `to` | `MoneyFlowResponse` |
| PATCH | `/transactions/:id/category` | `{ category, rememberForMerchant? }` | `{ transaction, merchantTransactionsUpdated }` |
| GET | `/transactions/category-options` | — | `{ categories: string[] }` |
| GET | `/transactions/export.csv` | same as list filters | `text/csv` stream |

---

## Accounts

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/accounts` | — | `{ accounts: Account[] }` (includes liability detail when available) |
| DELETE | `/accounts/:accountId` | — | `{ id, name, mask, transactionsDeleted, plaidItemDisconnected }` — cascades transactions; when the last account on a Plaid item is removed, calls Plaid `itemRemove` and deletes the item |
| POST | `/accounts/:accountId/sync` | — | `202` for Plaid, Teller, or SnapTrade-linked accounts |
| POST | `/plaid/sync` | — | `{ queued: number }` (sync all items) |

---

## Imports (statement upload)

Multipart upload for QFX/OFX/CSV/PDF statement files. Files encrypted at rest (AES-256-GCM) before parsing. See [statement-import-ui-and-security.md](statement-import-ui-and-security.md).

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/imports/formats` | — | `{ formats, limits, consentVersion }` |
| POST | `/imports/batches` | `multipart/form-data`: `files[]`, `consentAccepted=true` | `{ batchId, status, filesTotal, message }` |
| GET | `/imports/batches/:batchId` | — | `{ batch, summary, files[] }` — per-file status, errors, `canRetry`/`canReplace`, preview |
| POST | `/imports/batches/:batchId/confirm` | `{ accountMappings?, fileIds? }` | `{ batchId, status, txnsInserted, txnsSkipped, filesImported, message }` |
| POST | `/imports/batches/:batchId/retry-failed` | — | `{ batchId, retried, message }` |
| POST | `/imports/batches/:batchId/files/:fileId/retry` | — | `{ batchId, fileId, message }` |
| POST | `/imports/batches/:batchId/files/:fileId/replace` | `multipart/form-data`: `file` | `{ batchId, fileId, message }` |
| DELETE | `/imports/batches/:batchId` | — | `204` |

**Limits (defaults, env-configurable):** 12 files, 10 MiB/file, 120 MiB/batch.

---

## Analytics (Phase 3.7–3.9)

Consolidated intelligence layer replacing fragmented `/insights/*`, `/protect/*`, and ad-hoc wealth rollups. Source of truth: [`analytics-architecture.md`](../architecture/analytics-architecture.md).

**Honesty rule:** every metric uses the [metric envelope](#metric-envelope). Heuristic and external metrics MUST include `confidence` and `caveats`. Savings/return rates are **0–1 fractions** with `unit: "percent"`; the client multiplies by 100 exactly once for display.

Legacy routes remain during migration; new UI work targets `/analytics/*`.

### Metric envelope

Every analytics scalar, score, and KPI field is wrapped:

```jsonc
{
  "value": "1234.56",
  "unit": "USD",            // USD | percent | months | ratio | score
  "grain": "monthly",
  "asOf": "2026-06-01",
  "class": "diagnostic",    // descriptive | diagnostic | predictive | prescriptive
  "basis": "heuristic",     // factual | heuristic | external
  "confidence": 0.62,       // 0..1 from data quality
  "trend": {
    "delta": "-3.10",
    "deltaPct": -4.2,
    "direction": "down",    // up | down | flat
    "comparison": "vs trailing-6mo median"
  },
  "caveats": ["Credit limit unknown; utilization excluded"]
}
```

TypeScript: `MetricEnvelope`, `MetricTrend` in `ui/src/types/api.ts`; `MetricEnvelope` in `backend/src/services/metrics/types.ts` (Phase 3.7).

### Endpoints

Common query params: `from`, `to` (`YYYY-MM-DD`), `month` (some overview panels). Tabular sub-resources accept [`ListQuery`](#list--pagination).

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/analytics/overview` | `from`, `to` | `AnalyticsOverviewResponse` — health composite, savings rate, net cash flow, top alerts, data-quality summary (all envelope-wrapped) |
| GET | `/analytics/cashflow` | `from`, `to` | `CashflowAnalyticsResponse` — net cash flow, burn rate, free cash flow, income stability, monthly series |
| GET | `/analytics/spending` | `from`, `to`, `ListQuery` | `SpendingAnalyticsResponse` — fixed/variable/discretionary split, essential vs non-essential, volatility, HHI, `categories: Page<CategorySpendRow>` |
| GET | `/analytics/merchants` | `ListQuery` | `MerchantsTableResponse` — `Page<MerchantRow>` + `summary` (top/most-visited/fastest-growing computed server-side). Sort whitelist: `total`, `visits`, `trend`, `name`, `avgTransaction`, `lastSeen` |
| GET | `/analytics/recurring` | `ListQuery` | `RecurringAnalyticsResponse` — subscriptions/bills with lifecycle (`active` \| `lapsed` \| `price-changed`), `subscriptions: Page<SubscriptionRow>`, lifestyle cost audits |
| GET | `/analytics/investments/performance` | `from`, `to`, `accountId?` | `InvestmentPerformanceResponse` — unrealized/realized P/L, XIRR, TWR (post-snapshots), fee drag, max drawdown, benchmark delta |
| GET | `/analytics/investments/behavior` | `from`, `to` | `InvestmentBehaviorResponse` — heuristic flags (overtrading, panic selling, …) each with `confidence` + evidence trades |
| GET | `/analytics/inflation` | `from`, `to`, `ListQuery` | `InflationAnalyticsResponse` — personal CPI (Laspeyres), nominal vs real spend, BLS compare (external), `categories: Page<InflationCategoryRow>` |
| GET | `/analytics/resilience` | — | `ResilienceAnalyticsResponse` — composite score + sub-scores (liquidity, income stability, expense flexibility, debt burden, investment liquidity), shock scenarios |
| GET | `/analytics/planning/runway` | — | `RunwayResponse` — runway months, essential burn, liquid reserves |
| GET | `/analytics/planning/payoff` | — | `PayoffResponse` — avalanche/snowball ETA per debt |
| GET | `/analytics/planning/goals` | — | `GoalsAnalyticsResponse` — goal pace vs deadline, suggested goals |
| GET | `/analytics/planning/scenarios` | — | `ScenariosResponse` — surplus allocation recommendation |
| GET | `/analytics/planning/calendar` | `month` | `PlanningCalendarResponse` — bills, subscriptions, income events, safe-to-spend |
| GET | `/analytics/data-quality` | — | `DataQualityResponse` — categorization coverage, sync freshness, transfer-pair coverage, reconciliation gap |

**Implementation status:** `GET /analytics/merchants`, `/analytics/data-quality`, `/analytics/investments/performance`, `/analytics/recurring`, and `/analytics/resilience` are live. Remaining endpoints are Phase 3.7–3.9 (`TASK-ANALYTICS-*`).

### `InvestmentPerformanceResponse`

`GET /analytics/investments/performance?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId?`

All money KPIs use the [metric envelope](#metric-envelope). Return rates (`xirr`, `twr`, `maxDrawdown`, `dividendTtmYield`, `feeDrag`, `cashDrag`, `benchmarkDelta`) are **0–1 fractions** with `unit: "percent"`.

```jsonc
{
  "from": "2025-06-01",
  "to": "2026-06-01",
  "asOf": "2026-06-01",
  "portfolioValue": "125430.50",
  "unrealizedGain": { "value": "8430.50", "unit": "USD", "basis": "factual", /* … */ },
  "realizedGain": { "value": "2150.00", "unit": "USD", "basis": "factual", /* … */ },
  "shortTermGain": { "value": "450.00", "unit": "USD", /* … */ },
  "longTermGain": { "value": "1700.00", "unit": "USD", /* … */ },
  "xirr": { "value": "0.1245", "unit": "percent", "class": "diagnostic", "basis": "factual", /* … */ },
  "twr": { "value": "0.1180", "unit": "percent", "basis": "factual", /* … */ },
  "maxDrawdown": { "value": "-0.0820", "unit": "percent", "basis": "factual", /* … */ },
  "benchmarkDelta": { "value": "0.0230", "unit": "percent", "basis": "external",
    "caveats": ["Benchmark: SPY buy-and-hold return"] },
  "dividendTtmYield": { "value": "0.0180", "unit": "percent", /* … */ },
  "feeDrag": { "value": "0.0045", "unit": "percent", /* … */ },
  "cashDrag": { "value": "0.0020", "unit": "percent", "basis": "heuristic",
    "caveats": ["Cash drag assumes idle brokerage cash earns 0% vs benchmark"] },
  "washSaleCount": 1,
  "dividendTrend": [{ "month": "2026-05", "amount": "142.30" }],
  "confidence": 0.85,
  "caveats": []
}
```

**Computation notes (server-side only):**
- **Realized/unrealized P/L** — FIFO `tax_lots` rebuilt from `investment_transactions`; sells consume oldest lots; short/long-term split at 366 days; wash-sale flagged when a loss sale is followed by a repurchase within 30 days.
- **XIRR** — money-weighted return over dated cashflows (contributions/buys negative, dividends/sells/fees positive) plus terminal portfolio value at `to`.
- **TWR / max drawdown** — from daily `holdings_snapshots` (via `mart_portfolio_daily` aggregation), geometrically linked sub-period returns with external cash-flow adjustment.
- **Benchmark delta** — portfolio TWR minus buy-and-hold return of SPY (or VT) from `security_prices`; `basis: "external"`.
- **Fee drag** — total fees / average portfolio value, annualized over the period.
- **Cash drag** — `(idle_cash / total_investable) × benchmark_return`; heuristic when brokerage cash exceeds invested holdings value.

Returns `404` when no investment transaction history exists for the scoped user/household.

### Composite scores

**Financial Health** (replaces 7-dimension wellness): weighted blend of savings rate (22), free cash flow (16), emergency fund (16), debt health (16), investing (14), spending discipline (10), goal pace (6) — each sub-score 0–100 with per-dimension `confidence`, composite `confidence` on `WellnessResponse`. Essential burn uses `dim_category.is_essential`. Goal pace is deadline-aware. No fabricated dimensions (Inflation Beat, Investment Growth, Income-to-Expense removed).

**Resilience:** `0.30·Liquidity + 0.20·IncomeStability + 0.20·ExpenseFlexibility + 0.20·DebtBurden + 0.10·InvestmentLiquidity`. Bands: 0–39 critical · 40–59 vulnerable · 60–74 stable · 75–89 resilient · 90–100 fortified.

---

## Insights (legacy — migrating to `/analytics/*`)

| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET | `/insights/alerts` | `month` | `{ alerts: Alert[] }` |
| GET | `/insights/trends` | `from`, `to` | `{ trends: CategoryTrend[] }` |
| GET | `/insights/subscriptions` | — | `{ subscriptions: Subscription[] }` (V2) |

### Insights — advanced (V2, legacy)

| Method | Path | Response |
|--------|------|----------|
| GET | `/insights/wellness` | `WellnessResponse` — superseded by `/analytics/overview` health composite |
| GET | `/insights/dna` | `DnaResponse` — Phase 3.9 Spending DNA |
| GET | `/insights/patterns` | `PatternsResponse` — superseded by `/analytics/spending` |
| GET | `/insights/behavioral` | `BehavioralResponse` |
| GET | `/insights/merchants` | `MerchantsResponse` — superseded by `/analytics/merchants` |

---

## Wealth

| Method | Path | Response |
|--------|------|----------|
| GET | `/wealth/net-worth` | `NetWorthResponse` — `current` totals, `breakdown` by account type (depository/investment/credit), monthly `trend` |
| GET | `/wealth/investments` | `InvestmentsResponse` — optional `accountId` query filters portfolio totals and rows server-side |
| GET | `/wealth/fire` | `FireResponse` — live inputs plus `projection` (`fireNumber`, `yearsToFire`, `fireAge`, `investingRate`, `curve`). Optional query overrides: `monthlySpend`, `monthlyInvest`, `withdrawalRate`, `realReturn` |
| PATCH | `/wealth/fire` | `FireProfilePatch` body (`currentAge`, `withdrawalRate`, `realReturn` — at least one) → `FireResponse` |

---

## User profile

| Method | Path | Response |
|--------|------|----------|
| GET | `/user/profile` | `UserProfileResponse` — identity (name, email) + analytics preferences + live account-derived totals when linked |
| PATCH | `/user/profile` | `UserProfilePatch` body (at least one field) → `UserProfileResponse` |
| GET | `/user/analytics-profile` | Same analytics fields as above without `user` (deprecated alias) |
| PATCH | `/user/analytics-profile` | FIRE subset: `currentAge`, `withdrawalRate`, `realReturn` (deprecated alias) |

`UserProfilePatch` fields: `displayName`, `currentAge`, `householdSize`, `annualGrossIncome`, `targetRetirementAge`, `employmentStatus` (`employed` \| `self_employed` \| `retired` \| `student` \| `other`), `riskTolerance` (`conservative` \| `moderate` \| `aggressive`), `withdrawalRate`, `realReturn`.

---

## Planning

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/planning/budgets` | — | `BudgetsResponse` — persisted budgets, `suggestedBudgets[]`, active goals, `suggestedGoals[]`, safe-to-spend |
| POST | `/planning/budgets` | `{ category, periodMonth, limit, emoji?, color?, source?, class? }` | `BudgetRow` — upsert on `(user, category, periodMonth)` |
| PATCH | `/planning/budgets/:budgetId` | `{ limit?, emoji?, color?, class? }` (≥1 field) | `BudgetRow` |
| DELETE | `/planning/budgets/:budgetId` | — | `{ id }` |
| POST | `/planning/goals` | `{ name, target, current?, deadline?, emoji?, color?, kind?, status?, source?, accountId? }` | `GoalRow` |
| PATCH | `/planning/goals/:goalId` | `{ name?, target?, current?, deadline?, emoji?, color?, kind?, status?, accountId? }` (≥1 field) | `GoalRow` |
| DELETE | `/planning/goals/:goalId` | — | `{ id }` |
| GET | `/planning/recurring` | — | `RecurringResponse` — subscriptions, bills, price changes, leak fees + lifestyle habits |
| GET | `/planning/calendar` | — | `CalendarResponse` — month events (bills/subscriptions/income), spend heatmap, safe-to-spend today (derived) |
| GET | `/planning/forecast` | — | `ForecastResponse` — 14-day cash-flow projection with weather, comfort floor, recommendation (derived) |

### `BudgetsResponse`

```typescript
interface BudgetItem {
  id?: string; // persisted budgets only
  category: string;
  emoji: string | null;
  color: string | null;
  spent: string;
  limit: string;
  source: "user" | "suggested";
  class?: "essential" | "discretionary" | null;
  rationale?: string;
  confidence?: "low" | "medium" | "high";
}

interface GoalItem {
  id?: string; // persisted goals only
  name: string;
  emoji: string | null;
  color: string | null;
  target: string;
  current: string;
  deadline: string | null;
  kind: "emergency" | "debt" | "sinking" | "surplus" | "custom";
  status: "active" | "achieved" | "dismissed";
  source: "user" | "suggested";
  rationale?: string;
  confidence?: "low" | "medium" | "high";
  monthlySetAside?: string;
  accountId?: string | null;
}

interface BudgetsResponse {
  periodMonth: string; // YYYY-MM
  safeToSpend: string;
  daysRemaining: number;
  isLive: boolean;
  budgets: BudgetItem[];
  suggestedBudgets: BudgetItem[];
  goals: GoalItem[];
  suggestedGoals: GoalItem[];
}
```

Suggestions (`suggestedBudgets`, `suggestedGoals`) are computed server-side and not persisted until accepted via POST. Dismiss a suggested goal with `POST /planning/goals` `{ ..., status: "dismissed", source: "suggested" }` so it does not reappear.

---

## Protect (legacy — migrating to `/analytics/*`)

| Method | Path | Response |
|--------|------|----------|
| GET | `/protect/inflation` | `InflationResponse` — superseded by `/analytics/inflation` |
| GET | `/protect/resilience` | `ResilienceResponse` — superseded by `/analytics/resilience` |

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

Shared types live in `backend/src/lib/` and `backend/src/services/` and are mirrored in `ui/src/types/api.ts`.

### List & pagination

```typescript
interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  from?: string;
  to?: string;
}

interface Page<TRow> {
  rows: TRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  dir: "asc" | "desc";
  appliedFilters: Record<string, string>;
}
```

Backend: `parseListQuery()` + `buildPage()` in `backend/src/lib/list-query.ts`.

### Metric envelope

```typescript
type MetricUnit = "USD" | "percent" | "months" | "ratio" | "score";
type MetricClass = "descriptive" | "diagnostic" | "predictive" | "prescriptive";
type MetricBasis = "factual" | "heuristic" | "external";
type TrendDirection = "up" | "down" | "flat";

interface MetricTrend {
  delta: string;
  deltaPct: number;
  direction: TrendDirection;
  comparison: string;
}

interface MetricEnvelope {
  value: string;
  unit: MetricUnit;
  grain: string;
  asOf: string;
  class: MetricClass;
  basis: MetricBasis;
  confidence: number;
  trend?: MetricTrend;
  caveats?: string[];
}
```

### Domain types

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
  savingsRate: number; // 0–1 fraction (unit=percent; multiply by 100 once in UI)
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
| GET | `/household/insights` | Bearer | Household-level spend/income rollups; optional `from`/`to` query params (defaults to calendar YTD) |
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
