# Analytics Architecture

**Status:** Design (target for Phase 3.7–3.9)
**Audience:** Backend, frontend, PM
**Related tasks:** `TASK-ANALYTICS-*`, `TASK-UI-ANALYTICS-*`, `TASK-DOCS-ANALYTICS-001` in [`../development/tasks.yaml`](../development/tasks.yaml)

This document is the source of truth for the SpendFlow personal-finance intelligence layer:
metric definitions, the data model that supports them, the scoring frameworks, and the
implementation roadmap. It exists because the first-generation analytics code shipped a
number of **fabricated, duplicated, or stubbed** metrics that look production-grade but are
not analytically correct. Tasks reference this doc as their `source_docs`.

> **Honesty rule:** every metric is tagged `basis ∈ {factual, heuristic, external}`. Heuristic
> and external metrics MUST surface a confidence score and a caveat in the API. Never present
> an inference (especially brokerage-behavior inference) as a fact.

---

## 1. Audit — what was wrong (baseline)

These are concrete defects in the pre-redesign code. Tasks that fix them link back here.

### Backend

| # | Location | Defect | Fix task |
|---|----------|--------|----------|
| B1 | `compute-wellness.ts` `accountMetrics` | Credit limit invented as `balance * 2.5` ⇒ utilization is a near-constant ~40%. | `TASK-ANALYTICS-003` |
| B2 | `compute-wellness.ts` "Inflation Beat" dim | `clampScore(savingsScore * 0.85)` — not inflation, a scaled copy of savings. | `TASK-ANALYTICS-006` |
| B3 | `compute-wellness.ts` history loop | Per-month history reuses **current** balances + a **constant** investment score; only savings rate varies, so the trend line is an artifact. | `TASK-ANALYTICS-006` |
| B4 | `compute-wellness.ts` emergency months | `liquidCash / (monthThisMonthSpend || 1)` — single-month, divide-by-1 when spend is 0. | `TASK-ANALYTICS-006` |
| B5 | `compute-wellness.ts` goal pace | "on track" = `current/target ≥ 0.5`, ignores the deadline entirely. | `TASK-ANALYTICS-006` |
| B6 | `protect-analytics.ts` | "Personal inflation rate" = static `CATEGORY_INFLATION` table reweighted by spend share; never measures the user's own prices. National CPI hardcoded `3.1`. | `TASK-ANALYTICS-017` |
| B7 | `protect-analytics.ts` | Salary fabricated as `max(monthlyIncome, burn) * 12` when income missing. | `TASK-ANALYTICS-006` |
| B8 | `protect-analytics.ts` | No composite resilience **score** exists — only `liquidCash`, `monthlyBurn`, and template scenarios with hardcoded shock amounts. | `TASK-ANALYTICS-011` |
| B9 | `investment-analytics.ts` | No real performance: `estimatedValueToday = totalContributed * growthMultiple`; `investmentGrowth` score is arbitrary point buckets. No XIRR/TWR/realized-unrealized/drawdown/benchmark. | `TASK-ANALYTICS-013/014/015/018` |
| B10 | `investments-store.ts` `getNetWorth` | Trend reads `net_worth_snapshots`, which **nothing writes** in production ⇒ empty net-worth trend. | `TASK-ANALYTICS-004` |
| B11 | `transaction-store.ts` `getCategories` | `deltaVsPriorMonth: 0` hardcoded ⇒ category trend is fake. | `TASK-ANALYTICS-016` |
| B12 | `detect-recurring.ts` | Merchant keyed by raw lowercased name (no normalization) fragments series; only weekly/monthly cadence; price-change only on last two charges; no zombie/duplicate detection. | `TASK-ANALYTICS-009` |
| B13 | multiple | "Savings rate" defined 4 different ways (`compute-wellness`, `compute-wrapped`, `transaction-store`, `protect-analytics`) with different filters. No single metric layer. | `TASK-ANALYTICS-002` |
| B14 | sign convention | Expenses positive, depository income negative, `abs()` sprinkled per-query; no CHECK constraint — a single sign error silently corrupts every metric. | `TASK-ANALYTICS-001` |
| B15 | transfers | Only credit-card payments + explicit internal-transfer category recognised. Bank↔bank and bank↔brokerage ACH are not paired ⇒ net-investment-rate and true savings leak/double-count. No refund/reversal netting. | `TASK-ANALYTICS-010` |
| B16 | everywhere | No data-quality/confidence layer (only an `isLive` boolean). No seasonality handling. No FX guard (mixed-currency sums). | `TASK-ANALYTICS-007/016` |

### Frontend

| # | Location | Defect | Fix task |
|---|----------|--------|----------|
| F1 | `app/(dashboard)/page.tsx`, `wrapped-banner.tsx`, `mock-api.ts` | `savingsRate` is 0–1 on the dashboard but 0–100 in Wrapped/mocks ⇒ mock mode shows ~2,585%. | `TASK-UI-ANALYTICS-001` |
| F2 | `lib/date-ranges.ts`, `transaction-row.tsx`, `subscriptions-panel.tsx` | `toISOString()` / `new Date('YYYY-MM-DD')` ⇒ UTC off-by-one day/month-edge in filters and labels. | `TASK-UI-ANALYTICS-002` |
| F3 | `leaks-panel.tsx`, `subscriptions-panel.tsx`, `cash-flow-overview-strip.tsx` | `$0` rendered while loading / no empty state ⇒ zero shown as measured data. | `TASK-UI-ANALYTICS-003` |
| F4 | `resilience-panel.tsx`, `merchants-panel.tsx` | Runway `Infinity` when burn is 0; sparkline `i/(len-1)` NaN with one point. | `TASK-UI-ANALYTICS-003` |
| F5 | preview panels | `isLive` exists in `types/api.ts` but is never surfaced ⇒ users cannot tell computed from placeholder. | `TASK-UI-ANALYTICS-004` |
| F6 | `fire-panel.tsx`, `inflation-panel.tsx`, `time-machine-panel.tsx` | FIRE accelerator adds $400 to investing instead of cutting spend; "savings rate" mislabel; "faster than average" hardcoded; time-machine 1.45× constant shown as a backtest. | `TASK-UI-ANALYTICS-005` |
| F7 | `category-analytics-panel.tsx`, `interactive-area-chart.tsx`, `cash-flow-overview-strip.tsx` | Real `deltaVsPriorMonth` overwritten with 0; area-chart header always "spent"; expense bar widths can exceed 100%. | `TASK-UI-ANALYTICS-006` |
| F8 | `lib/format-money.ts` vs `lib/chart-utils.ts` | Two money formatters with different locale rules; chart tooltips drop currency/2-dp standard. | `TASK-UI-ANALYTICS-007` |

---

## 2. Taxonomy

Four layers, strict downward dependency (no upward calls):

```
L0  Raw facts        transactions, investment_transactions, accounts, holdings,
                     securities, credit_card_liabilities, *_snapshots
L1  Canonical/dims   signed_amount, dim_category (spend_class/is_essential),
                     dim_merchant (normalized), transfer_links, fx_rates, tax_lots
L2  Metric layer     services/metrics/* — one function per metric, ONE definition,
                     grain-aware, returns the metric envelope (see §7)
L3  Scores/narrative health & resilience composites, alerts, coach — consume L2 ONLY
```

Ten KPI domains: **1 Cash flow · 2 Spending behavior · 3 Budgeting & variance ·
4 Savings & liquidity · 5 Debt health · 6 Investment performance & behavior ·
7 Inflation & cost-of-living drift · 8 Resilience · 9 Goals & planning ·
10 Data quality / reconciliation.**

Each metric carries `class ∈ {descriptive, diagnostic, predictive, prescriptive}` and
`basis ∈ {factual, heuristic, external}`.

---

## 3. KPI catalog (selected formulas)

Money is `numeric`, serialized as 2-dp strings; percentages via `roundPercent()`.

### Cash flow
- **Net cash flow** = `SUM(signed_amount)` excl. transfers (monthly). descriptive/factual.
- **Burn rate (essential)** = trailing-3mo avg of essential outflow. diagnostic.
- **Free cash flow** = `income − essential − debt_min − committed_recurring`. diagnostic.
- **Income stability** = `1 − stdev(monthly_income)/mean(monthly_income)` over 12mo. diagnostic.

### Spending behavior
- **Fixed/Variable/Discretionary** = `SUM(outflow)` grouped by `dim_category.spend_class`.
- **Essential vs non-essential** = grouped by `dim_category.is_essential`.
- **Spending volatility** = `stdev(daily_spend)/mean(daily_spend)` (CoV, trailing 90d).
- **Merchant concentration (HHI)** = `Σ (merchant_share)²` trailing 90d (needs `dim_merchant`).
- **Category trend (seasonally adj.)** = `this_month / median(same category, trailing 6mo) − 1`.
- **Subscription price creep** = `latest_charge / charge_6mo_ago − 1` per series. heuristic.

### Savings & liquidity
- **Cash savings rate** = `(income − total_outflow) / income`. **Canonical 0–1 fraction.**
- **Net-investment rate** = `net_contributions / income` (uses `transfer_links`).
- **Emergency-fund months** = `liquid_reserves / trailing3mo_essential_burn`. Target 6.
- **Liquidity coverage** = `liquid_reserves / (essential + debt_min over next 30d)`.

### Debt health
- **Credit utilization** = `Σ card_balance / Σ credit_limit`. **Requires real limit** (Plaid); else `confidence = 0`, do not fabricate.
- **DTI (cash)** = `monthly_debt_payments / monthly_income`.
- **Payoff ETA** = amortization sim (avalanche/snowball) at current surplus. predictive/prescriptive.

### Investment performance & behavior
- **Unrealized P/L** = `Σ qty·price − Σ qty·cost_basis`. factual.
- **Realized P/L** = proceeds − FIFO-matched cost (`tax_lots`). factual.
- **XIRR** = IRR over dated cashflows incl. terminal value. The only honest return for irregular deposits.
- **TWR** = geometric link of sub-period returns (needs daily `holdings_snapshots`).
- **Fee drag** = `Σ fees / avg_portfolio_value` annualized. **Cash drag** = `idle_cash / value × benchmark_return`.
- **Max drawdown** = `min(value/running_peak − 1)`.
- **Benchmark delta** = `portfolio_TWR − SPY_TWR` (external).
- Behavioral flags (overtrading, performance chasing, panic selling, buy-high/sell-low,
  tax-inefficiency, idle-cash) — **all heuristic**, ship with confidence + the evidence trades.

### Inflation & cost-of-living drift
- **Personal CPI (Laspeyres)** = `Σ(price_now·qty_base)/Σ(price_base·qty_base) − 1` over the
  user's repeat-purchase / fixed-bill basket. Best-effort: recurring merchants + fixed bills
  (rent, utilities, insurance, subs). Shrinkflation is **not** detectable without line items.
- **Nominal vs real spend** = `real = nominal / (1 + personal_cpi)`.
- **Real savings rate** = savings rate adjusted for personal CPI.
- **CPI-linked compare** — BLS series. external (must be marked).

### Resilience — see §6.
### Goals & planning
- **Runway** = `liquid_reserves / essential_burn` (no income). predictive.
- **Goal pace** = `required_monthly = (target − current)/months_left` vs actual. prescriptive.
- **Surplus allocation** (prescriptive):
  ```
  if emergency_months < 3:      100% → cash EF
  elif high_interest_debt > 0:  100% → debt (APR > expected real return)
  elif emergency_months < 6:    50% cash / 50% invest
  else:                         20% buffer / 80% invest
  ```

### Data quality / reconciliation
- **Categorization coverage** = `1 − uncategorized_spend / total_spend`.
- **Sync freshness** = days since `accounts.last_synced_at`.
- **Transfer-pair coverage** = `% transfer outflows linked to an inflow`.
- **Reconciliation gap** = `SUM(signed_amount) vs Δ account balance` per account/month.
- Composite scores multiply by a confidence derived from these.

---

## 4. Data model additions

### 4.1 Canonical sign (migration)
```sql
ALTER TABLE transactions
  ADD COLUMN signed_amount numeric(14,2)
  GENERATED ALWAYS AS (
    CASE
      WHEN transaction_type = 'expense' THEN -abs(amount)
      WHEN transaction_type = 'income'  THEN  abs(amount)
      ELSE 0
    END
  ) STORED;
CREATE INDEX tx_user_date_idx ON transactions (user_id, date);
CREATE INDEX tx_user_cat_date_idx ON transactions (user_id, category, date);
```
All cashflow SQL uses `SUM(signed_amount)`. No per-query sign branching.

### 4.2 Dimensions
```sql
CREATE TABLE dim_category (
  category      text PRIMARY KEY,
  spend_class   text NOT NULL CHECK (spend_class IN ('fixed','variable','discretionary','income','transfer')),
  is_essential  boolean NOT NULL DEFAULT false,
  cpi_weight_eligible boolean NOT NULL DEFAULT false
);

CREATE TABLE dim_merchant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  canonical_key text NOT NULL,
  UNIQUE (user_id, canonical_key)
);
ALTER TABLE transactions ADD COLUMN merchant_id uuid REFERENCES dim_merchant(id);
```

### 4.3 Time-series snapshots (unlock trends/TWR/drawdown)
```sql
CREATE TABLE balance_snapshots (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  balance_current numeric(14,2),
  balance_available numeric(14,2),
  credit_limit numeric(14,2),
  PRIMARY KEY (account_id, as_of_date)
);
CREATE TABLE security_prices (
  security_id uuid NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  as_of_date date NOT NULL, close_price numeric(18,4) NOT NULL,
  PRIMARY KEY (security_id, as_of_date)
);
CREATE TABLE holdings_snapshots (
  user_id uuid NOT NULL, account_id uuid NOT NULL, security_id uuid NOT NULL,
  as_of_date date NOT NULL,
  quantity numeric(20,8) NOT NULL,
  market_value numeric(14,2) NOT NULL,
  cost_basis_total numeric(14,2) NOT NULL,
  PRIMARY KEY (account_id, security_id, as_of_date)
);
```
Write all three **on every sync** (idempotent upsert keyed by date).

### 4.4 Transfer pairing + tax lots
```sql
CREATE TABLE transfer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  outflow_txn_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  inflow_txn_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  inflow_investment_txn_id uuid REFERENCES investment_transactions(id) ON DELETE CASCADE,
  match_confidence numeric(4,3) NOT NULL,
  link_kind text NOT NULL CHECK (link_kind IN ('bank_bank','bank_brokerage','cc_payment'))
);
-- Pairing: opposite sign, |Δamount| ≤ $1 or ≤1%, |Δdate| ≤ 4 days, different account.

CREATE TABLE tax_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, account_id uuid NOT NULL, security_id uuid NOT NULL,
  open_txn_id uuid REFERENCES investment_transactions(id),
  open_date date NOT NULL,
  quantity_open numeric(20,8) NOT NULL,
  quantity_remaining numeric(20,8) NOT NULL,
  cost_per_unit numeric(18,4) NOT NULL
);
```

---

## 5. Warehouse / materialized layer

PostgreSQL-first. Materialized views refreshed `CONCURRENTLY` at the end of each sync job
(add a `refresh-marts` step to the BullMQ worker). The **current month stays live** (query raw
for the in-progress month, marts for closed months). TimescaleDB is worth it only for the three
snapshot tables (continuous aggregates for daily→monthly rollups); plain MVs for the rest.

Marts: `mart_cashflow_month`, `mart_category_month`, `mart_net_worth_month`,
`mart_portfolio_daily`, `mart_recurring`. See `TASK-ANALYTICS-016` for DDL.

---

## 6. Scoring frameworks

### Financial Health (replaces the 7-dimension model; removes fabricated dims)
`Health = Σ wᵢ·subᵢ`, each `subᵢ ∈ [0,100]`:

| Sub-score | Weight | Driver |
|-----------|-------:|--------|
| Savings rate | 22 | `min(rate/0.20,1)·100` |
| Free cash flow | 16 | `FCF>0 ? scale(FCF/income) : 0` |
| Emergency fund | 16 | `min(months/6,1)·100` (essential burn denominator) |
| Debt health | 16 | blend(real utilization, DTI, revolving flag) |
| Investing | 14 | blend(net-invest rate, XIRR vs benchmark) |
| Spending discipline | 10 | inverse volatility + discretionary share |
| Goal pace | 6 | deadline-aware on-track ratio |

Composite confidence = weighted min of sub-score confidences; display it.

### Resilience (new)
```
Resilience = 0.30·Liquidity + 0.20·IncomeStability + 0.20·ExpenseFlexibility
           + 0.20·DebtBurden + 0.10·InvestmentLiquidity
```
| Sub-score | Formula |
|-----------|---------|
| Liquidity | `min(emergency_months/6,1)·100` |
| Income stability | `(1 − CoV_income)·100`; single income source caps at 70 |
| Expense flexibility | `discretionary / total_outflow · 100` |
| Debt burden | `100 − min(DTI/0.36,1)·100` |
| Investment liquidity | `liquid_invest / total_invest · 100` |

**Bands (both scores):** 0–39 critical · 40–59 vulnerable · 60–74 stable · 75–89 resilient ·
90–100 fortified. Each sub-score returns the single highest-leverage action.

### Alerts (table-driven `alert_rules`)
price creep, zombie/duplicate subscription, overdraft/ATM fee, utilization spike, EF breach,
runway < 3mo, lifestyle inflation (heuristic), bill-cluster cash dip, wash-sale risk (heuristic),
idle-cash drag, stale sync, reconciliation gap.

---

## 7. API contract — metric envelope

Every analytics value uses this envelope so the UI can render confidence and so heuristics
never masquerade as facts:

```jsonc
{
  "value": "1234.56",
  "unit": "USD",            // USD | percent | months | ratio | score
  "grain": "monthly",
  "asOf": "2026-06-01",
  "class": "diagnostic",    // descriptive | diagnostic | predictive | prescriptive
  "basis": "heuristic",     // factual | heuristic | external
  "confidence": 0.62,       // 0..1, derived from data quality
  "trend": { "delta": "-3.10", "deltaPct": -4.2, "direction": "down",
             "comparison": "vs trailing-6mo median" },
  "caveats": ["Credit limit unknown; utilization excluded"]
}
```

**Percent convention:** all savings/return rates are emitted as a **0–1 fraction** with
`unit: "percent"`; the client multiplies by 100 for display exactly once. (Fixes F1.)

Endpoints (consolidated): `GET /analytics/overview`, `/analytics/cashflow`,
`/analytics/spending`, `/analytics/recurring`, `/analytics/investments/performance`,
`/analytics/investments/behavior`, `/analytics/inflation`, `/analytics/resilience`,
`/analytics/planning/{runway|payoff|goals|scenarios|calendar}`, `/analytics/data-quality`.
Full request/response shapes are added to [`../design/api-contract.md`](../design/api-contract.md)
by `TASK-DOCS-ANALYTICS-001`.

---

## 8. Roadmap

- **Phase 3.7 (P1, must-have):** signed_amount + metric layer; real credit limit; balance
  snapshots + net-worth pipeline; dim_category spend-class split; remove fabricated metrics &
  rebuild Health; data-quality endpoint. Frontend: savingsRate scale, UTC dates, loading/empty
  guards, isLive badges.
- **Phase 3.8 (P2, high-value):** merchant normalization; recurring engine v2; transfer pairing
  + refund netting; resilience composite; alert engine; investment snapshots + FIFO lots +
  realized/unrealized + XIRR + dividend/fee/cash drag; materialized marts + seasonal deltas;
  personal CPI.
- **Phase 3.9 (P3, advanced):** TWR + benchmark + drawdown; behavior heuristics w/ evidence;
  planning engine (runway MC, payoff sim, scenarios, surplus allocation); honest Spending DNA.

---

## 9. Risks & assumptions

- Validate sign conventions, category coverage, and cost-basis quality against real rows before
  trusting numbers (`normalizeCostBasisPerUnit` / `repairNonContributionInvestmentTxns` signal
  existing data issues).
- TWR, drawdown, net-worth trend, historical utilization are **structurally blocked** until the
  snapshot pipeline (4.3) exists — it is a prerequisite, not optional.
- Personal CPI is best-effort (recurring + fixed bills only); shrinkflation undetectable.
- All brokerage behavioral signals are heuristic — ship with confidence + evidence or not at all.
- Transfer pairing is probabilistic; keep `match_confidence` and let unmatched transfers degrade
  confidence rather than guessing.
- Single-currency assumption today; add `fx_rates` before mixing currencies.

---

## 10. Pagination, tabular reports & the thin-client rule

### 10.1 Thin-client rule (iOS readiness)
**All calculation, ranking, truncation, sorting, and aggregation happen in the backend.**
Clients (web + iOS) render rows as received and never recompute totals, percentages, P/L,
ranks, or trends. This is already mandated by `.cursor/rules/ui-typescript.mdc` and `AGENTS.md`
("all clients are thin") but is violated in many analytics surfaces. Moving the math server-side
is what prevents the iOS app from re-deriving (and re-bugging) the same numbers.

Client recomputation to remove (web), so iOS inherits correct values:
net-worth hero sum, holdings P/L on account filter, income variance/stability, FIRE projection
math, time-machine multiple, merchant KPI ranks (top/most-visited/fastest-growing).

### 10.2 Truncation audit — fixed top-N served as if complete
| Location | Cap | Fix |
|----------|-----|-----|
| `coach-store.ts` getMerchants | `.slice(0, 6)` | paginate + sort/filter (`TASK-PAGINATE-002`) |
| `compute-patterns.ts` | `.limit(5)` categories | full list, client shows top-N |
| `transaction-store.ts` getMoneyFlow | `LIMIT 10` sources | paginate |
| `protect-analytics.ts` | `.slice(0, 9)` inflation cats | full list |
| `coach-ask.ts` | top 5 subscriptions | n/a (narrative text) |

These are deliberate caps, **not** pagination. Replace with the list contract below; the UI
decides how many to display, but the API must be able to return all rows on request.

### 10.3 Standard list contract
Tabular/list endpoints accept a uniform query and return a uniform page envelope. Use
**offset pagination with a total count** for tabular reports (page numbers + sort + filter);
reserve **cursor pagination** for high-volume append-only feeds (the transactions list already
uses cursor/infinite-scroll — keep it).

Request query params:
```
?page=1&pageSize=25          # 1-based page, pageSize ∈ [1,200] (default 25)
&sort=total&dir=desc         # sort = a server-whitelisted column; dir = asc|desc
&q=starbucks                 # optional free-text filter (server-defined fields)
&from=2026-01-01&to=2026-06-30   # optional date window
&...facets                   # endpoint-specific filters (category, accountId, etc.)
```

Response envelope:
```jsonc
{
  "rows": [ /* fully-computed row objects, money as 2-dp strings */ ],
  "page": 1,
  "pageSize": 25,
  "total": 184,
  "totalPages": 8,
  "sort": "total",
  "dir": "desc",
  "appliedFilters": { "q": "starbucks", "from": "2026-01-01" }
}
```

Rules:
- **Sort/filter are server-side.** Whitelist sortable columns (reject others with 400) — never
  trust an arbitrary column name in SQL. Validate query with Zod.
- Each row is fully computed server-side (totals, %, trend, rank metadata). No client math.
- `total` is the unfiltered-by-page count **after** facet/`q` filters, so the client can render
  page controls.
- Scope every query by authenticated `userId` / household, as today.

### 10.4 Reusable web `DataTable`
A single client component (`ui/src/components/ui/data-table.tsx`) renders any list endpoint:
sortable column headers, a filter/search box, and pagination controls, with sort/filter/page
state mirrored to the URL (`useSearchParams`) and fetched via TanStack Query. It performs **no**
aggregation — it only passes query params and renders `rows`. The merchants page is the
reference implementation (`TASK-PAGINATE-002` + `TASK-PAGINATE-004`); transactions, holdings,
subscriptions, categories, and money-flow follow the same pattern (`TASK-PAGINATE-005/006`).
