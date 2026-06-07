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

---

## 11. Calculation-correctness audit (C-series defects)

Findings from validating the math in every shipped analytics feature. Each defect lists the
**file:line**, the **symptom** the user sees, the **root cause**, and the **expected fix**. These
map 1:1 to `TASK-CALC-*` tasks. Severity: **P1** = wrong numbers shown as fact; **P2** = wrong
period/representation; **P3** = limitation/inconsistency.

> Sign convention note: most of these assume expense `amount` is stored positive and income
> positive (income often summed with `ABS`). A single signed-amount convention
> (`TASK-ANALYTICS-001`) would remove a whole class of these. Until then, fixes must not assume a
> sign without checking the column.

| ID | Sev | File:line | Symptom → Root cause → Fix |
|----|-----|-----------|----------------------------|
| **C1** | P1 | `compute-patterns.ts:27-52` | "Average spend by day of week" numbers are absurdly high. The query does `SUM(amount)` grouped by `extract(dow)` over **all history** — it's a lifetime total per weekday, not an average. **Fix:** divide by the number of occurrences of that weekday in the data window, i.e. `SUM(amount) / COUNT(DISTINCT date)` per dow (average spend on a typical Mon/Tue/…). Keep the UI label or change to "Total"; pick one and make data match. |
| **C2** | P1 | `compute-wellness.ts:17-22,100,102` | Debt-Health and Income-to-Expense scores move the wrong way (high credit utilization scores *well*; low expense ratio scores *poorly*). `scoreFromRatio(value,target,false)` returns `(target/value)*100`, which **increases** with the bad quantity. **Fix:** for lower-is-better metrics, score should be `clamp((ideal/actual)*100)` so higher actual → lower score. Verify both call sites and add unit tests with known inputs. |
| **C3** | P1 | `compute-wellness.ts:84,200,226` | Credit utilization & Debt-Health are fiction — `creditLimit = balance * 2.5`. **Fix:** use the real limit (`TASK-ANALYTICS-003`). If limit unknown, **omit** utilization and exclude the dimension with a caveat — never fabricate. |
| **C4** | P2 | `compute-wellness.ts:197-216` | The wellness "history" line is misleading: every past month reuses **current** balances (`accountMetrics` has no date), so emergency-fund, utilization and investment dims are flat across history; only income/expense vary. **Fix:** requires balance snapshots (`TASK-ANALYTICS-004`). Until then, only chart the dimensions that are truly historical (cash-flow), or label clearly. |
| **C5** | P1 | `compute-wellness.ts:139` | "Inflation Beat" dimension is fabricated: `savingsScore * 0.85`. **Fix:** compute from personal inflation vs nominal savings/return (see `TASK-ANALYTICS-017` personal CPI) or remove from the composite. |
| **C6** | P1 | `investment-analytics.ts:765-829` (used `compute-wellness.ts:145`) | "Investment Growth" score is an arbitrary point formula (`40 + investRate*2 + tier`), unrelated to actual returns. **Fix:** replace with a real metric (contribution rate or, post-snapshots, return) or drop from the composite. Covered with `TASK-ANALYTICS-006`. |
| **C7** | P1 | `investment-analytics.ts:652-657` | "Estimated value today" is fabricated: lifetime contributions × (current holdings value / cost). **Fix:** report actual cost basis vs current market value (unrealized gain), not contributions × a ratio. Remove the synthetic estimate. |
| **C8** | P1 | `transaction-store.ts:562` vs `compute-wellness.ts:55`, `compute-wrapped.ts:163`, `protect-analytics.ts:287` | Savings rate is a **fraction (0–1)** in `getSummary` but a **percent (0–100)** in wellness/wrapped/protect, and definitions differ (income−expense vs income−cashBurn). The UI then multiplies inconsistently. **Fix:** one definition + one representation (emit a 0–1 fraction with `unit:"percent"`, multiply by 100 once in UI). Ties to `TASK-UI-ANALYTICS-001` and the metric layer `TASK-ANALYTICS-002`. |
| **C9** | P2 | `transaction-store.ts:660` | Money-flow ignores the selected period (`void from; void to;`) — it always shows all-time. **Fix:** apply the `from/to` date filter to every money-flow query. |
| **C10** | P2 | `transaction-store.ts:756,787` | Trends ignore the period (`void from; void to;`) **and** `slice(0,8)` takes the first 8 categories **alphabetically**, not the top 8 by spend. **Fix:** apply date filter; rank categories by total spend before slicing (or paginate per `TASK-PAGINATE-005`). |
| **C11** | P2 | `transaction-store.ts:647` | Category "vs prior month" delta is hardcoded `deltaVsPriorMonth: 0`, so any delta the UI shows is fake. **Fix:** compute the real delta against the prior comparable period, or remove the field and its UI. |
| **C12** | P2 | `transaction-store.ts:725-728` | Money-flow `transfersOut` = `ABS(sum)` of **all** transfers (both legs of each transfer), double-counting. **Fix:** count one direction (outflow only) or net the paired legs (`transfer_links`, `TASK-ANALYTICS-009`). |
| **C13** | P2 | `compute-wrapped.ts:180-195` | "No-spend days" counts **future** days for the current year (loops to Dec 31). **Fix:** cap the end of the range at `min(today, year-end)`. |
| **C14** | P2 | `detect-recurring.ts:140,144` | Subscriptions always show `status:"active"` and a `nextChargeDate` that can be in the past for stopped subs. **Fix:** mark inactive when last charge is older than ~1.5× cadence; set `nextChargeDate` null when stale. Annual cadence also unsupported (P3). |
| **C15** | P3 | `lifestyle-habits.ts:61` vs `detect-recurring.ts:26` | Category/subcategory string literals drift between services ("Subscriptions & Digital" vs "Subscriptions & Software"; habit subcategory names may not exist in `config/categories.ts`), so matchers silently never fire. **Fix:** import category/subcategory names from the single source (`config/categories.ts`); add a test asserting every literal exists. |
| **C16** | P2 | `investment-analytics.ts:686-690` | Net worth treats only `credit` accounts as liabilities; `loan`/mortgage account types are added as **assets**. **Fix:** classify loan/mortgage/liability account types as liabilities (confirm the enum in `schema.ts`). |
| **U1** | P2 | `ui/.../panels/merchants-panel.tsx` (income tab) | The "Income by month (primary + side)" chart has no y-axis, no value labels, and no tooltip — bars are unreadable, and "Income stability = 100 − CV%" can go negative/>100. **Fix:** add a labeled y-axis or per-bar value labels + hover tooltip, clarify the legend, and clamp/relabel stability. Every chart must let a user read the actual numbers. |

**Cross-cutting recommendation:** the durable fix for C2, C5, C6, C8 is the single metric layer
(`TASK-ANALYTICS-002`): each KPI defined once, with a unit, and unit-tested against hand-computed
fixtures so a small model can verify correctness without guessing.

---

## 12. Intelligent budgets & savings goals

### 12.1 Current state (gaps)
- **Budgets** (`planning-store.ts:getBudgets`): auto-suggests limits from the **mean** of the prior
  3 months **+10%**, but only when the user has **zero** configured budgets for the period, and it
  caps at the **top 10** categories. Once any budget is saved, suggestions disappear (no merge).
- **Savings goals**: returned verbatim from the `savings_goals` table — **never auto-created**.
- **No CRUD**: `/planning/*` is read-only (`routes/planning.ts`). The UI's "+ Add category budget"
  and "+ Add savings goal" buttons (`budgets-panel.tsx`) have no handlers — they do nothing.

### 12.2 Smarter budget suggestions
Make budgets data-driven and additive instead of all-or-nothing:
- Suggest a limit for **every category** the user actually spends in (appears in ≥2 of the last 6
  months **or** exceeds a small monthly threshold), not just the top 10. The UI decides how many to
  show / paginates (`DataTable`, §10).
- Use a **robust** baseline: median (or trimmed mean) of the last 6 months rather than a 3-month mean
  skewed by one-off spikes. Round to a sensible increment.
- **Merge** suggested + user-configured: when the user has saved some budgets, still return
  suggestions for the **un-budgeted** categories so they discover more. Tag every item with
  `source: "user" | "suggested"` and a short `rationale` ("avg $X over 6 mo, +10% buffer").
- Tag each budget `class: essential | discretionary` (from `dim_category`, `TASK-ANALYTICS-005`) so
  the UI can group "needs vs wants" and the user budgets the controllable ones.
- Attach `confidence` from month-coverage (few months → low confidence + caveat).

### 12.3 Auto-generated savings goals
Generate **suggested** goals from data; the user accepts, edits, dismisses, or adds their own. Each
suggestion is `source:"suggested"` and is **not** persisted until accepted. Generators:
- **Emergency fund** — target = 3–6 × monthly **essential** burn (from the resilience profile,
  `protect-analytics.ts`); `current` = liquid depository cash (or a tracked sub-amount).
- **Debt payoff** — one per credit card / loan with a balance > 0; target = balance. (Progress needs
  balance snapshots, `TASK-ANALYTICS-004`; until then `current` = 0 with a caveat.)
- **Sinking funds** — for large annual/irregular bills detected in recurring (`recurring_series`,
  cadence annual): target = bill amount, suggested monthly set-aside = amount / months-until-due.
- **Surplus saver** — if monthly surplus (income − expense − invest) is positive, suggest a
  round-number monthly savings goal sized to the surplus.
Show "why" text on every suggestion so it's meaningful (§ "everything on the UI must be meaningful").

### 12.4 Schema + API additions
- `budgets`: add `source text default 'user'` (`user|suggested`), optional `class text`
  (`essential|discretionary`). Suggestions can be returned without rows; persisted on accept.
- `savings_goals`: add `kind text default 'custom'` (`emergency|debt|sinking|surplus|custom`),
  `status text default 'active'` (`active|achieved|dismissed`), `source text default 'user'`.
- Endpoints (writes, validate with Zod, scope to user/household):
  - `POST /planning/budgets` `{ category, periodMonth, limit, emoji?, color? }` (upsert on the
    existing unique index) · `PATCH /planning/budgets/:id` · `DELETE /planning/budgets/:id`
  - `POST /planning/goals` `{ name, target, current?, deadline?, emoji?, color?, kind? }` ·
    `PATCH /planning/goals/:id` · `DELETE /planning/goals/:id`
- `getBudgets` response gains `suggestedBudgets[]` and `suggestedGoals[]` (each with `source`,
  `rationale`, `confidence`), leaving the existing `budgets[]`/`goals[]` as the persisted set.

All math stays server-side (thin-client rule, §10.1) so web and iOS share identical suggestions.

---

## 13. Lifestyle cost-audit engine & subscription lifecycle

### 13.1 Current state (why only ~1 audit shows)
"Plan → Recurring → Lifestyle cost audit" renders `recurring.leaks.habits`, produced by
`lifestyle-habits.ts` from **4 hardcoded `HABIT_DEFS`** (coffee, dining, rideshare, subscriptions),
each gated by a `minMonthly` threshold. Several never match because the category/subcategory
literals drift from the taxonomy (defect **C15**), so in practice only one or two appear. The
"Hidden fees" tab is likewise thin: the backend only returns a single **ATM** fee row
(`planning-store.ts` `leaks.fees`) even though the UI already has copy for overdraft, maintenance,
late, and FX fees.

### 13.2 Data-driven audit engine (target: 10–20+ audits)
Replace the fixed habit list with an engine that derives many audits from the user's own data.
Each audit shares a shape so the UI can render them uniformly and sort by impact:

```jsonc
{
  "id": "delivery-premium",
  "type": "habit | delivery | duplicate_subscription | price_hike | lapsed_subscription |
           impulse | fee | category_overspend | merchant_frequency",
  "emoji": "🍔",
  "title": "Food delivery premium",
  "monthly": "182.40",            // money strings, 2dp
  "annual": "2188.80",
  "opportunityCost10y": "31000.00", // optional FV at a documented rate (move FV math server-side)
  "rationale": "23 DoorDash/UberEats orders in 90 days; ~35% markup vs grocery spend.",
  "action": "Batch-cook 2 nights/week to cut ~8 orders/mo.",
  "savingsEstimate": "70.00",     // est. monthly recoverable
  "confidence": 0.7
}
```

Audit generators (each emits 0..n audits, all from real rows):
- **Habit/frequency** — for each discretionary subcategory/merchant with recurring spend (coffee,
  fast food, bars, gaming, streaming, fitness, rideshare, …), derived from the **actual** top
  discretionary merchants/subcategories, not a fixed list. Use `dim_category`
  (`TASK-ANALYTICS-005`) for essential/discretionary.
- **Delivery premium** — DoorDash/UberEats/Grubhub spend and its markup vs grocery spend.
- **Duplicate / overlapping subscriptions** — multiple services in the same lane (e.g. >1 video or
  music subscription).
- **Price-hike** — recurring series with `priceChanged` (what the increase costs annually).
- **Lapsed / zombie subscription** — see §13.3.
- **Impulse / frequent small purchases** — many sub-$X charges at one merchant.
- **Fee audits** — ATM, overdraft, maintenance, late, FX, surcharge (expand beyond ATM-only).
- **Category overspend** — categories materially above the user's own trailing baseline.
Sort by `savingsEstimate` (or `annual`) desc; the UI paginates (§10). Move the future-value math
(currently in `leaks-panel.tsx`) into the engine so iOS gets the same opportunity-cost numbers.

### 13.3 Subscription lifecycle (cancelled / stale detection)
Today every detected recurring item is `status:"active"` with a `nextChargeDate` that can be in the
past (defect **C14** / `TASK-CALC-010`). Add a lifecycle:
- **active** — charged within ~1.0× cadence.
- **lapsed / possibly-cancelled** — no charge for > ~1.5× cadence (e.g. a monthly sub silent for
  45+ days). Surface as a positive audit: "No charge from <X> in N months — looks cancelled,
  saving ~$Y/yr. Confirm?" and stop counting it in active monthly/annual totals.
- **price-changed** — flagged separately for the price-hike audit.
Set `nextChargeDate` null when the prediction is already in the past. This both fixes the bogus
"active" counts and gives the user the "did you cancel this?" check they expect when transactions
stop appearing.

> Ambiguity: the second user request ("check on already cancelled subscriptions when there are no
> recent transactions") is read as "the system does **not** do this yet — add it." If the intent
> was the opposite, only the surfacing copy changes, not the detection.

All audits and lifecycle states are computed server-side (thin-client rule) so web and iOS match.

---

## 14. Transfer reconciliation & duplicate prevention (R-series)

### 14.1 Current state (what already works)
- **Credit-card payments** are detected by Plaid PFC (`LOAN_PAYMENTS_CREDIT_CARD_PAYMENT`) + text
  patterns (`transfer-classification.ts`) and marked `is_transfer=true`,
  `category="Transfers (internal)"`, so they're excluded from spend/income in every analytics query
  (which filter `is_transfer=false AND category != internal`).
- **Leg-to-leg pairing exists**: `transfer-pairing.ts:refreshTransferLinks` runs after every Plaid,
  Teller, and SnapTrade sync, matching outflow↔inflow by amount (±$1 / ±1%) and date (±4 days) into
  a `transfer_links` table with a confidence score and `linkKind` (`bank_bank`, `bank_brokerage`,
  `cc_payment`).
- **Within-account dedup**: both Plaid upsert and statement import compute a
  `bankingDedupFingerprint(accountId, date, amount, name)` and skip duplicates, so importing a CSV
  for an account already synced via Plaid does not double-insert **within that account**.

### 14.2 Gaps and status
| ID | Sev | Status | Symptom → Root cause → Fix |
|----|-----|--------|----------------------------|
| **R1** | P1 | **DONE** (`TASK-RECON-001`) | Pairing was computed but **not fed into the spend/income KPIs** (they excluded transfers only via the per-transaction `is_transfer` flag), so a paired leg still typed `income`/`expense` (card-payment credit leg, non-Plaid sources) double-counted. **Fixed:** `reconcileLinkedTransferLegs` runs inside `refreshTransferLinks` and reclassifies both legs of high-confidence links to `is_transfer=true` / `transfer`, so every KPI filter now excludes them. |
| **R2** | P2 | **DONE** (`TASK-RECON-002`) | `data-quality.ts` hardcoded transfer-pair coverage to 0 with a "not yet implemented" caveat. **Fixed:** it now calls `transferPairCoverage(ctx.userIds)` and reflects the real ratio in `compositeConfidence`. |
| **R3** | P2 | **DONE** (`TASK-RECON-003`) | Bank↔bank savings/checking transfers from Teller / SnapTrade / CSV / manual were only internal if pre-tagged. **Fixed:** matched pairs are reconciled via R1; a conservative self-transfer fallback + an unpaired-transfer data-quality caveat handle the remainder. |
| **R4** | P3 | OPEN (`TASK-RECON-004`) | Dedup fingerprint is scoped to a single `accountId`. If the **same real account is linked via two providers** (two Plaid items, or Plaid + Teller), rows land under different `accountId`s and the same transaction appears **twice** → duplicated spend/income. **Fix:** detect likely-duplicate accounts (institution + mask + type) and duplicate transactions across them; surface in data-quality with a merge/ignore path. |
| **R5** | P3 | tracked as C15 | Duplicate **categories** in breakdowns from category-name drift across services (e.g. "Subscriptions & Software" vs "Subscriptions & Digital"). **Fix:** single-source the taxonomy (`TASK-CALC-011`). Also confirm money-flow transfer handling (C9/C12, `TASK-CALC-006/008`). |

### 14.3 Outcome
**R1–R3 are implemented.** Pairing is now authoritative: because all KPIs, categories, money-flow,
wellness, and audits exclude `is_transfer=true`, reconciling both legs of a high-confidence
`transfer_link` removed double-counting everywhere at once — and gives iOS the same reconciled data
with no client logic. Remaining: **R4** (cross-provider duplicate accounts) and **R5/C15**
(duplicate category names).

### 14.4 Savings/checking → investment transfers (regular contributions)
This is a `bank_brokerage` flow and is mostly handled, with one gap:
- **Bank (depository) outflow leg** — when synced via **Plaid** it carries a `TRANSFER_OUT` PFC,
  which `plaid/map-transaction.ts` maps to `Transfers (internal)` / `is_transfer=true`, so it is
  **excluded from spend**. Correct.
- **Brokerage inflow leg** — lands in `investment_transactions` (type `contribution`/`buy`), which
  is a **separate table** and is never part of the spend/income transaction KPIs, so it does not
  double-count as spend. It is surfaced as a contribution / holding.
- **Pairing** — `refreshTransferLinks` matches the two legs as `bank_brokerage`;
  `sumLinkedBrokerageContributions` counts the contribution **once** for the net-investment-rate
  metric.
- **Former gap, now fixed:** when the bank-side leg came from a **non-Plaid source** (Teller / CSV /
  manual) or Plaid did not tag it `TRANSFER_OUT`, the outflow was **counted as spend** while the
  brokerage side was **also** counted as a contribution — the money showed as both "spent" and
  "invested." `reconcileLinkedTransferLegs` (R1, `TASK-RECON-001`) now reclassifies the paired
  `bank_brokerage` outflow leg to `transfer` so it is excluded from spend, and the self-transfer
  fallback (R3, `TASK-RECON-003`) handles unmatched legs.
- **Net worth is not double-counted:** at the moment of transfer the bank balance drops and the
  holding value rises by the same amount, so net worth is unchanged — that is correct accounting,
  not a duplication.

---

## 15. Mock-data gating, data integrity & tenant isolation

Audit triggered by: "with `NEXT_PUBLIC_USE_MOCKS=false` the UI must use **only** the backend API,
and the backend must never return mock / inaccurate / other users' data."

### 15.1 UI mock gating — clean, with one caveat
- There is a **single** switch: `USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true"`
  (`api-client.ts`, mirrored in `use-current-user.ts` and `auth-session.ts`). Every mock branch —
  including the CSV-export helper `exportMockTransactionsCsv` — is behind it. With the flag `false`
  **or unset**, all calls go through `fetchJson` to the backend. Mocks turn on **only** when the
  value is exactly `"true"`.
- **Only** `api-client.ts` imports `@/lib/mock-api`; no component, hook, or page imports fixtures
  directly. So all data flows through the gated client.
- **Caveat (M1):** `NEXT_PUBLIC_*` vars are inlined by Next.js at **build time**, not runtime.
  A production image must be **built** with `NEXT_PUBLIC_USE_MOCKS=false` (or unset); flipping it
  only at runtime has no effect. Recommend a build-time assertion / CI check that production builds
  never bundle with mocks enabled, and ideally that `mock-api` is tree-shaken out of prod bundles.

### 15.2 Backend — no mock data served
- No route or service returns mock/demo/sample/seed data. The only `fixture`/`sample` references
  are in `__tests__` (test inputs), never in runtime responses.
- **Non-determinism (M2):** `planning-engine.ts:124` uses `Math.random()` for a Monte-Carlo shock in
  projections. That is legitimate simulation, but it makes forward-looking numbers
  **non-reproducible** between requests and can read as "inaccurate." Recommend a **seeded** RNG (or
  closed-form percentiles) plus a clear "projection / estimate" label so two loads agree.

### 15.3 Tenant isolation — read paths are scoped
- Every read/analytics service that queries `transactions` resolves the caller's
  `resolveHouseholdContext(userId)` and filters via `drizzleActiveTransactionWhere(userIds,
  accountIds)` / `resolveActiveAccountScope`. A file-by-file cross-check found **no read service
  missing scoping**.
- The only `.from(transactions)` services without household scoping are **ingestion**
  (`plaid/upsert-transactions.ts`, `import/persist-banking.ts` — scoped by the explicit
  account/user being synced) and **global maintenance backfills**
  (`backfill-transfers.ts`, `backfill-subcategories.ts`). The backfills intentionally scan all rows
  but are **writes**, not API responses, so they cannot leak one user's data into another's response.
- **Hardening (M3):** add an automated **multi-user isolation test** — seed two households, hit each
  read endpoint as user A, and assert no row/aggregate from user B appears. This locks in the
  current good state and catches any future service that forgets to scope.

---

## 16. FIRE projection accuracy (F-series)

The FIRE number itself is correct: `fireNumber = annual_spend / withdrawal_rate` (the 25× rule;
`$50,400 / 0.04 = $1,260,000`, `computed-fields.ts:computeFireProjection`). The **time-to-FIRE / FIRE
age** is what misleads (e.g. "1.9 years" for a 42-year-old). Defects:

| ID | Sev | Where | Symptom → Root cause → Fix |
|----|-----|-------|----------------------------|
| **F1** | P1 | `computed-fields.ts:152` + `investment-analytics.ts:computeLiveNetWorth` | Years-to-FIRE seeds the starting portfolio with **total net worth** (`currentNetWorth` = checking + savings + cash + investments − debts) and grows the whole thing at the real return toward the 25× target. The 4%-SWR target assumes a **liquid, invested** portfolio, so including cash buffers / non-retirement assets overstates progress and makes FIRE look far closer than it is. **Fix:** seed the projection with **investable assets** — investment/brokerage/retirement balances (reuse `investmentLiquidityTotals` / holdings) plus, at most, liquid cash **above** the emergency-fund target — not total net worth. Keep total net worth as a separate display number. |
| **F2** | P1 | `investment-analytics.ts:722` (`DEFAULT_FIRE_AGE = 35`) | When the user has not set their age, the projection uses a **default age of 35**, so `fireAge = currentAge + years` is wrong for anyone older (the user is 42). `isDefaultAge` is already returned. **Fix:** the UI must prompt for age before showing a FIRE age, and copy should say "set your age" until `isDefaultAge` is false; do not present a FIRE age computed off the default. |
| **F3** | P2 | `investment-analytics.ts:averageMonthlyCashSpending/averageMonthlyInvestment` (3-mo window) | Spend and contributions are trailing **3-month** averages — a short, volatile window that misses lumpy annual costs (insurance, tuition, holidays), usually **understating** annual spend (and thus the FIRE number). **Fix:** use a longer trailing window (12 months) and/or annualize irregular/known-annual categories; surface the basis + a confidence/caveat. |
| **F4** | P2 | `computed-fields.ts` real-return default 6% | The default **6% real** return is optimistic and is **not surfaced** to the user, who can't tell inflation is already netted out. **Fix:** expose the assumptions (real return, SWR, that figures are in today's dollars) in the UI, default to a more conservative real return (≈4–5%), and let the user adjust. |
| **F5** | P3 | model scope | **Dependents / future costs** — current dependent spend is captured (it's in trailing transactions) but **future** step-changes (college, pre-Medicare healthcare, mortgage payoff) are not modeled, and there is no spend-in-retirement adjustment. **Fix (later):** optional retirement-spend override and known future cost events; clearly label the projection as a simple model. |

### 16.1 Recommended approach
**F1 + F2 are the fixes that matter most** for believability: project from investable assets (not
total net worth) and stop computing a FIRE age off the default 35. F3/F4 then make the inputs and
assumptions honest (longer window, conservative real return, assumptions shown). All math stays
server-side so web and iOS agree.

---

## 17. User profile as a shared reference — wiring gaps (P-series)

The profile is **one table** (`fire_profiles`) holding age, withdrawal rate, real return, household
size, annual gross income, target retirement age, employment status, and risk tolerance. Both
`/user/profile` and `/user/analytics-profile` read/write it through `user-profile-store.ts`. So the
**plumbing is unified** — the problem is that most fields are **collected but never consumed**.

### 17.1 What is actually wired
- **`currentAge`, `withdrawalRate`, `realReturn`** → read by `computeFireProfileInputs` and used by
  the FIRE projection. Saving age sets `ageUserSet=true`, the API returns `isDefaultAge=false`, and
  `fire-panel.tsx` switches from "Set your age in Profile" to "Using Age N". **This path works
  end-to-end.** If a user still sees the default, either the save didn't persist or they are reading
  the headline **years-to-FIRE**, which does **not** depend on age (only the derived *FIRE age*
  does); the implausible timeline is **F1** (total-net-worth seed), not age.

### 17.2 Profile field consumers (audit checklist)
Every profile field must have at least one consumer or be removed from the form.

| Field | Consumer(s) | Status |
|-------|-------------|--------|
| `currentAge` | FIRE projection (`isDefaultAge`, `fireAge`) | wired |
| `withdrawalRate` / `realReturn` | FIRE projection + panel overrides | wired |
| `targetRetirementAge` | FIRE on-track/behind + `requiredMonthlySavings` | wired (P1) |
| `riskTolerance` | Default real-return bands when not user-overridden | wired (P2) |
| `householdSize` | Emergency-fund target months in resilience analytics | wired (P3) |
| `annualGrossIncome` | — | backlog (P4 / `TASK-PROFILE-004`) |
| `employmentStatus` | — | backlog (no task yet) |

### 17.3 Principle & guard
**Don't collect what you don't use.** Regression coverage lives in
`backend/src/services/__tests__/profile-fire.test.ts` (risk bands, household size, investable
FIRE start). Any new profile field must update this checklist before shipping.

---

## 18. Wellness history chart, recalculate-all, and the dead Behavioral feature

### 18.1 Wellness "Score history" chart (W-series)
`wellness-panel.tsx:118-134` renders bars with month labels but:
- **No y-axis / scale** — nothing tells the user the domain is 0–100.
- **No per-bar value and no tooltip** — the score is never shown on or above a bar.
- **Misleading height** — `maxBar = Math.max(...history, 1)` normalizes bars to the **max score in
  the window**, not the 0–100 domain, so 60 vs 65 look wildly different and a flat-but-healthy
  history looks volatile.

**W1 (P2, ui):** add a y-axis/reference (0–100, with band lines at 55/70/85 to match the score
bands), show each bar's score (label above the bar and/or an accessible tooltip), and scale bar
height to the **0–100 domain**, not the window max. Same "make every chart self-explanatory" rule as
U1 (income chart). Reuse whatever axis/tooltip pattern U1 establishes.

### 18.2 Recalculate-all-metrics (RC-series)
There is **no way to force a full recompute.** `post-sync-analytics.ts:runPostSyncAnalytics` runs
only `refreshAnalyticsMarts` + `refreshProtectProfiles` + `evaluateUserAlerts`; most metrics are
computed **live on read**, and a handful are persisted on sync (marts, protect profiles, alerts,
transfer links + reconcile, FIRE profile, balance snapshots). The user wants a **button** to
recompute everything when data looks wrong, and — crucially — **recompute must be deterministic**:
running it N times must yield the same numbers (the "numbers should match no matter how many times I
refresh" expectation).

- **RC1 (P1, backend):** add `recomputeAllAnalytics(userId)` — a single idempotent orchestrator that
  re-runs every persisted refresher (marts force=true, protect profiles, alerts, `refreshTransferLinks`
  + `reconcileLinkedTransferLegs`, `refreshFireProfile`, balance snapshots, and the wellness/DNA/
  streak/challenge generators once they exist) — and expose `POST /analytics/recompute`. Return a
  summary of what was refreshed. Re-running must not change any persisted row.
- **RC2 (P1, ui):** a recalculate button/icon (header or each insights panel) that calls the endpoint,
  shows progress, then invalidates all financial queries (reuse `invalidate-financial-queries.ts`).
- **RC3 (P2, backend):** an **idempotency/determinism test** — run `recomputeAllAnalytics` twice on a
  seeded dataset and assert identical persisted rows and identical metric outputs. Depends on M2
  (seeded RNG) so projections don't drift. This is what makes "refresh = same number" true.

#### 18.2.1 What "refresh accounts" does today (and the ordering bug)
Each provider sync (`plaid/sync.ts:465-467`, `snaptrade/sync.ts:715-717`, `teller/sync.ts:236-238`)
pulls the latest data, then runs, **in this order**:
1. `runPostSyncAnalytics` → **marts + protect profiles + alerts only**
2. `backfillTransactionMerchantIds`
3. `refreshTransferLinks` → internally `reconcileLinkedTransferLegs` (flips `is_transfer`)

Two problems:
- **Ordering (RC4):** transfer **reconciliation runs *after* the analytics**, so marts / protect /
  alerts are computed from **pre-reconciliation** data and only catch up on the *next* sync. Transfer
  pairing + reconcile must run **before** the analytics refresh.
- **Coverage:** `runPostSyncAnalytics` is a **subset** of "all metrics." Wellness, DNA, patterns,
  wrapped, recurring, and (future) streaks/challenges are **computed live on read** — so they reflect
  the latest data the next time the page loads — but the FIRE profile is only refreshed on **SnapTrade**
  sync (not Plaid/Teller; it's refreshed on read instead), and there is no single "recompute
  everything" step.
- **RC4 (P1, backend):** make every sync path call `recomputeAllAnalytics` (RC1) **after** transfer
  reconcile, replacing the partial `runPostSyncAnalytics`, so a refresh deterministically rebuilds all
  persisted analytics from the just-synced data in the correct order.

### 18.3 Behavioral feature is a read-only shell (B-series)
`getBehavioral` (`insights-store.ts:179`) reads three tables — `transaction_reasons`, `challenges`,
`habit_streaks` — but a repo-wide search shows **nothing ever writes to them** (they appear only in
the reader, `export-user-data.ts`, and `purge-derived-financial-data.ts`). Therefore:
- **Habit streaks** are always empty.
- **Active challenges** are always empty.
- **Spend by reason** is always `$0.00` for every reason: `reasonTotals` is built from
  `transaction_reasons`, which is never populated, and there is **no tagging UI and no inference**.

Fixes (all server-side compute so web + iOS match):
- **B1 (P1, backend):** **Habit-streak engine** — derive streaks from transactions and persist to
  `habit_streaks`: e.g. current/best no-spend-day streak, consecutive under-budget months,
  days-since-last [discretionary category], consecutive months saving > 0. Run inside RC1 / post-sync.
- **B2 (P2, backend):** **Challenge engine** — auto-generate data-driven challenges into `challenges`
  with progress computed from transactions (e.g. "No-spend weekend", "Dining < $X this month", "Save
  $Y this month"), mark complete when met; allow user dismiss/accept. Run inside RC1 / post-sync.
- **B3 (P2):** **Spend-by-reason needs tagging to exist.** Reasons (impulse/social/etc.) are not in
  the data, so the honest fix is a **tagging UX**: `B3a (backend)` an endpoint to set/clear a
  transaction's reason → `transaction_reasons`; `B3b (ui)` a reason picker on the transaction row /
  behavioral panel plus an empty-state that explains tagging. Optional `B3c`: low-confidence
  heuristic *suggestions* (late-night, weekend, discretionary category) clearly labeled as guesses —
  never presented as fact (honesty rule). Until tags exist, the panel should show an explanatory
  empty-state, not silent `$0`.

> Analysis note: this matches the user's report (streaks/challenges empty, "spend by reason" $0). The
> root cause is missing **generation/tagging**, not a calculation bug — the read path is fine.

---

## 19. Household membership & account changes — refresh completeness (H-series)

**What works:** scope is resolved live as "all `isActive` accounts for the household `userIds`"
(`active-account-scope.ts`), and `accounts.is_active` defaults to **true**, so a newly added/synced
account enters every metric automatically on the next read. Household `userIds` =
owner + every `household_members` row with a non-null `userId` (`household-access.ts`), so a linked
family member's accounts are included once they exist under that member's user id.

**Caveats / gaps:**
- A member who is **invited but has not accepted** has `userId = null` → contributes nothing yet
  (expected). Owner-owned accounts **assigned** to a member stay under the owner's id, so they remain
  in scope regardless.
- **H1 (P2, ui):** `useHouseholdMutations.invalidate()` invalidates only `household`,
  `household-insights`, `accounts`, `chart-data`, `transactions` — **not** wellness, dna, patterns,
  behavioral, merchants, net-worth, investments, fire, recurring, budgets, summary, categories,
  money-flow. So after adding/assigning/linking a member, most panels show **pre-member** numbers
  until they refetch on their own. **Fix:** call the shared `invalidateFinancialQueries` (the ~22-key
  set) from household mutations.
- **H2 (P2, backend):** linking/adding a household member does **not** trigger a recompute, so
  **persisted** analytics (marts, protect profiles, wellness) stay stale for the household until the
  next sync or a manual recalculate. **Fix:** trigger `recomputeAllAnalytics` (RC1) for the household
  when membership changes (member accepts/links, account assigned), so persisted metrics include the
  member immediately. Depends on `TASK-RECOMPUTE-001`.

Net: new **accounts** flow into all metrics automatically; **member** changes need H1 + H2 so the
whole dashboard (not just a subset) reflects them without waiting for the next sync.
