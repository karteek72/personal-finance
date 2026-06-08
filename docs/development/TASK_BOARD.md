# Development Task Board

**Last updated:** 2026-06-07 (115/115 complete — all tasks done)  
**Source of truth:** [`tasks.yaml`](tasks.yaml)  
**CLI:** `npm run task -- <command>` from repo root

---

## Agent coordination (live)

| Agent | Scope | Tasks | Status |
|-------|-------|-------|--------|
| ui-analytics-wave1 | UI fixes + DataTable | UI-ANALYTICS-001–006, UI-CALC-001, PAGINATE-003 | done |
| docs-wave1 | Contract docs | DOCS-ANALYTICS-001, PAGINATE-001 | done |
| backend-calc-wave1 | Calc correctness P1 | CALC-001–003, CALC-005, CALC-009 | done |
| backend-foundation-wave1 | Schema + snapshots | ANALYTICS-001, ANALYTICS-003, ANALYTICS-004 | done |

| backend-calc-wave2 | Calc correctness P2 | CALC-004, CALC-006–008, CALC-011, CALC-012 | done |
| backend-audit-wave1 | Audit engine + recurring lifecycle | CALC-010, AUDIT-001–003 | done |
| backend-planning-wave1 | Planning CRUD + suggestions | PLAN-001–003 | done |
| backend-advanced-wave1 | Merchant dim + investment snapshots | ANALYTICS-008, ANALYTICS-013 | done |
| ui-wave2 | Remaining UI analytics | UI-ANALYTICS-001–007, UI-CALC-001, PAGINATE-003 | done |
| ui-plan-audit-wave1 | Planning + audit UI | UI-PLAN-001/002, UI-AUDIT-001 | done |
| backend-metric-wave2 | Metric layer + wellness history | ANALYTICS-002, CALC-013 | done |
| backend-paginate-wave2 | Paginated list endpoints | PAGINATE-002, PAGINATE-005 | done |

| backend-analytics-core-wave4 | dim_category, health rebuild, data-quality, thin-client | ANALYTICS-005–007, THINCLIENT-001 | done |
| backend-recurring-wave4 | Recurring v2, transfers, resilience | ANALYTICS-009–011 | done |
| backend-investment-wave4 | Tax lots, XIRR, TWR | ANALYTICS-014,015,018 | done |
| ui-paginate-wave4 | Merchants DataTable + rollouts | PAGINATE-004, PAGINATE-006 | done |

| backend-final-wave5 | Alert engine, marts, CPI, behavior, planning | ANALYTICS-012,016,017,019,020 | done |

| backend-recon-wave6 | Transfer reconciliation R1–R3 | RECON-001–003 | done |

**Status:** All tracked tasks complete. Phase 3.8 profile/income (**PROFILE-004**), household (**H1/H2**), and full iOS Phase 4 parity (**IOS-003–011**, **IOS-IMPORT-001**) shipped.

| household-ios-wave | H1/H2 + full iOS parity | HOUSEHOLD-001/002, IOS-001–011, IOS-CHARTS-001, IOS-IMPORT-001, PROFILE-004 | done |

**Rules for agents:** `npm run task -- claim TASK-ID <name>` before coding; `complete` when done; update this table; read `source_docs` per task.

---

## Status summary

| Status | Count |
|--------|------:|
| done | 104 |
| ready | 0 |
| in_progress | 0 |
| backlog | 1 |

**Statement import + GDPR export: complete.**

**Active focus:** Analytics intelligence redesign (Phase 3.7–3.9). The first-gen
analytics layer shipped fabricated/duplicated/stubbed metrics; see
[`../architecture/analytics-architecture.md`](../architecture/analytics-architecture.md)
for the audit, taxonomy, data model, and scoring frameworks. Tasks are scoped for
**parallel** work by independent agents.

**Next:** `TASK-PROFILE-004` (annualGrossIncome cross-check); `employmentStatus` consumer TBD.

---

## Analytics redesign (Phase 3.7–3.9)

Claim with `npm run task -- claim <ID> <agent-name>`. Honesty rule: heuristic/external
metrics must ship with a confidence + caveat — never present an inference as fact.

### Phase 3.7 — foundation (P1, must-have)

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-ANALYTICS-001 | backend | Canonical `signed_amount` + indexes | done |
| TASK-ANALYTICS-002 | backend | Metric layer (`services/metrics`) + envelope | done |
| TASK-ANALYTICS-003 | backend | Real credit limit; real utilization | done |
| TASK-ANALYTICS-004 | backend | `balance_snapshots` + net-worth pipeline | done |
| TASK-ANALYTICS-005 | backend | `dim_category` spend-class / essential split | done |
| TASK-ANALYTICS-006 | backend | Remove fabricated metrics; rebuild Health | done |
| TASK-ANALYTICS-007 | backend | Data-quality / confidence endpoint | done |
| TASK-UI-ANALYTICS-001 | ui | Normalize `savingsRate` scale + contract | — |
| TASK-UI-ANALYTICS-002 | ui | Fix UTC off-by-one dates | — |
| TASK-UI-ANALYTICS-003 | ui | Loading/empty guards + div0/NaN | — |
| TASK-UI-ANALYTICS-004 | ui | Surface `isLive` badges | — |
| TASK-DOCS-ANALYTICS-001 | docs | Sync api-contract / system-overview / PRD | — |

### Phase 3.8 — advanced (P2, high-value)

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-ANALYTICS-008 | backend | Merchant normalization + `dim_merchant` | done |
| TASK-ANALYTICS-009 | backend | Recurring engine v2 (creep/zombie/duplicate) | done |
| TASK-ANALYTICS-010 | backend | Transfer pairing + refund netting | done |
| TASK-ANALYTICS-011 | backend | Resilience composite score | done |
| TASK-ANALYTICS-012 | backend | Alert rule engine | done |
| TASK-ANALYTICS-013 | backend | Investment snapshots (prices + holdings) | done |
| TASK-ANALYTICS-014 | backend | Tax lots (FIFO) realized/unrealized P/L | done |
| TASK-ANALYTICS-015 | backend | XIRR + dividend trend + fee/cash drag | done |
| TASK-ANALYTICS-016 | backend | Materialized marts + seasonal deltas | done |
| TASK-ANALYTICS-017 | backend | Personal CPI + nominal vs real | done |
| TASK-UI-ANALYTICS-005 | ui | FIRE math + inflation/time-machine copy | — |
| TASK-UI-ANALYTICS-006 | ui | Preserve category deltas + chart fixes | — |
| TASK-UI-ANALYTICS-007 | ui | Consolidate money formatters | — |

### Phase 3.9 — advanced intelligence (P3)

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-ANALYTICS-018 | backend | TWR + benchmark + max drawdown | done |
| TASK-ANALYTICS-019 | backend | Behavior heuristics w/ evidence + confidence | done |
| TASK-ANALYTICS-020 | backend | Planning engine (runway/payoff/scenarios) | done |

### Pagination, tabular reports & thin-client

Many analytics surfaces serve a fixed top-N (e.g. merchants `.slice(0,6)`) with no pagination,
and clients recompute totals/ranks. Standardize server-side pagination/sort/filter and move all
calculation to the backend so iOS reuses it. See `analytics-architecture.md` §10.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-PAGINATE-001 | docs | Standard list/pagination contract | — |
| TASK-PAGINATE-002 | backend | Merchants endpoint paginated/sortable (reference) | 001 |
| TASK-PAGINATE-003 | ui | Reusable `DataTable` (sort/filter/page + URL state) | — |
| TASK-PAGINATE-004 | ui | Merchants page on `DataTable` (reference) | 002,003 |
| TASK-PAGINATE-005 | backend | Remove remaining caps; paginate list endpoints | 001 |
| TASK-PAGINATE-006 | ui | Apply `DataTable` to txns/holdings/subs/categories | 003,005 |
| TASK-THINCLIENT-001 | backend | Move residual UI calculations to backend | done |

**Parallelizable now (no deps):** A-001, A-003, A-004, A-008, A-013, all UI-ANALYTICS tasks,
PAGINATE-001, PAGINATE-003, and the docs tasks.

### Calculation-correctness audit (C-series)

Wrong NUMBERS shown across shipped features. Each task is scoped to one defect with exact
file:line and the expected formula. Full root-cause table in `analytics-architecture.md` §11.

| ID | Sev | Area | Defect |
|----|-----|------|--------|
| TASK-CALC-001 | P1 | backend | C1 day-of-week "average" is a lifetime sum |
| TASK-CALC-002 | P1 | backend | C2 inverted wellness lower-is-better scores |
| TASK-CALC-003 | P1 | backend | C3/C5/C6 fabricated wellness dimensions |
| TASK-CALC-004 | P1 | backend | C7 fabricated investment "estimated value today" |
| TASK-CALC-005 | P1 | backend | C8 savings-rate definition/scale inconsistent |
| TASK-CALC-006 | P2 | backend | C9/C10 money-flow & trends ignore period; trends mis-ranked |
| TASK-CALC-007 | P2 | backend | C11 category "vs prior month" delta hardcoded 0 |
| TASK-CALC-008 | P2 | backend | C12 money-flow transfersOut double-counts legs |
| TASK-CALC-009 | P2 | backend | C13 Wrapped no-spend-days counts future days |
| TASK-CALC-010 | P2 | backend | C14 recurring items always "active" / stale next-charge |
| TASK-CALC-011 | P3 | backend | C15 category-name drift across services |
| TASK-CALC-012 | P2 | backend | C16 net worth ignores loan/mortgage liabilities |
| TASK-CALC-013 | P2 | backend | C4 wellness history reuses current balances (needs A-004) | done |
| TASK-UI-CALC-001 | P2 | ui | U1 income-by-month chart has no axes/values/tooltip |

**Parallelizable now (no deps):** every C-series task except CALC-013 (done — uses balance snapshots).

### Intelligent budgets & savings goals

Budgets only auto-suggest when none configured (top-10, vanish on first save); savings goals are
display-only and never auto-created; `/planning/*` is read-only so the "+ Add" buttons do nothing.
Add CRUD + smarter, additive suggestions, all server-side. Design: `analytics-architecture.md` §12.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-PLAN-001 | backend | Budget & goal CRUD endpoints + schema (source/kind/status) | — |
| TASK-PLAN-002 | backend | Smarter additive budget suggestions (more categories, robust baseline) | PLAN-001 |
| TASK-PLAN-003 | backend | Auto-generate suggested savings goals from data | PLAN-001 |

**Start with `TASK-PLAN-001`** (CRUD + schema) — everything else builds on it.

### Lifestyle cost-audit engine & subscription lifecycle

"Lifestyle cost audit" shows ~1 item because it comes from 4 hardcoded habit buckets (several
broken by C15). Replace with a data-driven engine (10-20+ audits), expand hidden-fee detection,
and add cancelled/lapsed subscription detection. Design: `analytics-architecture.md` §13.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-AUDIT-001 | backend | Data-driven lifestyle cost-audit engine (10-20+) | — |
| TASK-AUDIT-002 | backend | Subscription lifecycle: lapsed/cancelled detection | — |
| TASK-AUDIT-003 | backend | Expand hidden-fee detection beyond ATM-only | — |

Related: `TASK-CALC-010` (C14) and `TASK-CALC-011` (C15) share root causes — coordinate.

---

### Transfer reconciliation & duplicate prevention

Transfer pairing (`transfer-pairing.ts`) now feeds back into spend/income KPIs via
`reconcileLinkedTransferLegs` (R1), data-quality reports real pair coverage (R2), and a
conservative self-transfer fallback plus unpaired-transfer caveat handle the non-Plaid long tail (R3).
Cross-provider duplicate detection remains open (R4). Design: `analytics-architecture.md` §14.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-RECON-001 | backend | Reconcile paired transfer legs so KPIs stop double-counting (R1) | done |
| TASK-RECON-002 | backend | Wire data-quality transfer-pair coverage to real impl (R2) | done |
| TASK-RECON-003 | backend | Self-transfer fallback + unpaired-transfer signal (R3) | done |
| TASK-RECON-004 | backend | Detect cross-provider duplicate accounts/transactions (R4) | — |

**R1–R3 complete** — pairing is authoritative for KPIs; data-quality reflects real coverage.
Savings/checking → investment transfers are the same `bank_brokerage` case and are covered by R1/R3
(see §14.4). Related: `TASK-CALC-006` (C9/C12 money-flow) and `TASK-CALC-011` (C15 dup categories).

---

### Mock-data gating, data integrity & tenant isolation

Audit confirmed the good state: UI mock gating is clean (single `NEXT_PUBLIC_USE_MOCKS` switch; only
`api-client` touches mocks), the backend serves no mock data, and **every** read endpoint scopes by
household + active account (no cross-user leakage). These tasks harden what already works.
Design: `analytics-architecture.md` §15.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-INTEGRITY-001 | ui | Guarantee prod builds never enable UI mocks (M1) | — |
| TASK-INTEGRITY-002 | backend | Make planning projections reproducible / seeded RNG (M2) | — |
| TASK-INTEGRITY-003 | backend | Multi-user tenant-isolation test for read endpoints (M3) | — |

---

### FIRE projection accuracy

The $1.26M FIRE number (25× spend) is correct, but time-to-FIRE / FIRE age is too optimistic: it
seeds the portfolio with **total net worth** instead of investable assets, computes a FIRE age off a
**default age of 35**, uses a short 3-month spend window, and hides an optimistic 6% real-return
assumption. Design: `analytics-architecture.md` §16.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-FIRE-001 | backend | FIRE projection from investable assets, not total net worth (F1) | — |
| TASK-FIRE-002 | ui | Require user age before showing a FIRE age (F2) | — |
| TASK-FIRE-003 | backend | Longer/annualized spend & contribution basis (F3) | — |
| TASK-FIRE-004 | ui | Surface FIRE assumptions; conservative real-return default (F4) | — |

**Start with `TASK-FIRE-001` + `TASK-FIRE-002`** — the two that make the date believable.

---

### User profile wiring (orphaned fields)

The profile is one unified table (`fire_profiles`); age / withdrawal rate / real return are wired
into FIRE end-to-end. But `targetRetirementAge`, `householdSize` (dependents), `annualGrossIncome`,
`riskTolerance`, and `employmentStatus` are **stored but referenced by no analytics** — collected
and ignored. Design: `analytics-architecture.md` §17.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-PROFILE-001 | backend | Use targetRetirementAge in FIRE (on-track/behind + required savings) (P1) | — |
| TASK-PROFILE-002 | backend | Map riskTolerance to default real-return bands (P2) | — |
| TASK-PROFILE-003 | backend | Use householdSize in emergency-fund & spend expectations (P3) | — |
| TASK-PROFILE-004 | backend | annualGrossIncome fallback/cross-check for income metrics (P4) | — |
| TASK-PROFILE-005 | backend | Regression test + audit that profile fields are consumed (P5) | — |

**Principle:** don't collect what you don't use — every profile field must feed a feature or be removed.

---

### Wellness history, recalculate-all & the dead Behavioral feature

Wellness history is bars with no axis/values (W1). There's no way to force a full recompute, and no
idempotency guarantee (RC). Behavioral is a read-only shell: `transaction_reasons`, `challenges`,
`habit_streaks` are read but **nothing writes to them**, so streaks/challenges are empty and
spend-by-reason is always $0 (B). Design: `analytics-architecture.md` §18.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-WELLNESS-UI-001 | ui | Wellness score-history: axis, values, 0-100 scaling (W1) | — |
| TASK-RECOMPUTE-001 | backend | recomputeAllAnalytics + POST /analytics/recompute (RC1) | — |
| TASK-RECOMPUTE-UI-001 | ui | Recalculate-all button + cache invalidation (RC2) | RECOMPUTE-001 |
| TASK-RECOMPUTE-002 | backend | Idempotency/determinism test for recompute (RC3) | RECOMPUTE-001, INTEGRITY-002 |
| TASK-RECOMPUTE-003 | backend | Wire sync to full recompute after reconcile; fix ordering (RC4) | RECOMPUTE-001 |
| TASK-BEHAVIORAL-001 | backend | Habit-streak engine — populate habit_streaks (B1) | — |
| TASK-BEHAVIORAL-002 | backend | Challenge engine — auto-generate challenges (B2) | — |
| TASK-BEHAVIORAL-003 | backend | Transaction reason tagging endpoint (B3a) | — |
| TASK-BEHAVIORAL-UI-001 | ui | Reason-tagging UI + behavioral empty states (B3b) | BEHAVIORAL-003 |

**Behavioral root cause:** missing generation/tagging, not a calc bug — the read path is fine.
Streaks/challenges (B1/B2) should run inside the recompute orchestrator (RC1).

---

### Household membership & account changes — refresh completeness

New accounts (isActive default true) auto-enter all metrics via live scope. But household member
changes only do a partial UI refresh and never trigger a recompute, so most panels show pre-member
numbers until the next sync. Design: `analytics-architecture.md` §19.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-HOUSEHOLD-001 | ui | Household mutations invalidate full financial query set (H1) | — |
| TASK-HOUSEHOLD-002 | backend | Recompute household analytics on membership change (H2) | RECOMPUTE-001 |

---

### Investments / holdings analytics (INV-series)

Backend already accepts an `accountId` filter and computes gain/loss, cost basis, and breakdown —
the UI just doesn't surface them. Add an account filter, drop the duplicate account list (it lives on
Net Worth), and enrich the header with winners/losers + charts. Design: `analytics-architecture.md` §20.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-INV-001 | ui | Filter holdings by account (backend ready) | — |
| TASK-INV-002 | ui | Remove duplicate account list from Investments | — |
| TASK-INV-003 | backend | Winners/losers, win rate, best/worst, concentration, sectors, profit/loss split | — |
| TASK-INV-004 | backend | Portfolio-value time series for trend chart | — |
| TASK-INV-005 | ui | Enriched KPI header + allocation/winners-losers/trend charts | INV-003 |
| TASK-INV-006 | backend | `kind` (stocks/options) filter on positions | — |
| TASK-INV-007 | ui | Split Holdings into Stocks/ETFs + Options tables | INV-006 |
| TASK-INV-008 | backend | Prune-losers what-if + momentum scoring | — |
| TASK-INV-009 | ui | "Trim losers" optimizer card | INV-008 |

---

### iOS feature parity (Phase 4, P4)

The SwiftUI app has the core (Auth + AppLock, push, Dashboard, MoneyFlow, Categories, Transactions,
Accounts, Settings, Plaid Link) but lacks all of Understand, Wealth, Plan, Protect, Debt, Family,
Profile, SnapTrade, import, and recalculate. Backend already owns all calculations (thin-client), so
iOS work is models + APIClient + SwiftUI views mirroring each web panel. **Note (AGENTS.md):** iOS is
deferred until the web import path ships — these are queued at the user's direction; confirm the gate
before implementing.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-IOS-001 | ios | APIClient + Codable models for all read endpoints | — |
| TASK-IOS-002 | ios | Navigation/IA mirroring web (Understand/Wealth/Plan/Protect) | IOS-001 |
| TASK-IOS-CHARTS-001 | ios | Shared chart + paginated-list components | — |
| TASK-IOS-003 | ios | Understand — Wellness/DNA/Patterns/Behavioral/Merchants | IOS-001/002/CHARTS-001 |
| TASK-IOS-004 | ios | Wealth — Net worth/Investments/FIRE | IOS-001/002/CHARTS-001 |
| TASK-IOS-005 | ios | Plan — Budgets/Goals/Recurring/Calendar/Forecast/Audits | IOS-001/002 |
| TASK-IOS-006 | ios | Protect — Resilience & Inflation | IOS-001/002/CHARTS-001 |
| TASK-IOS-007 | ios | Debt — credit/debt summary | IOS-001/002 |
| TASK-IOS-008 | ios | Family — members/assignment/invites | IOS-001/002 |
| TASK-IOS-009 | ios | Profile — wired into analytics (age → FIRE) | IOS-001/002 |
| TASK-IOS-010 | ios | SnapTrade brokerage connection | IOS-001 |
| TASK-IOS-011 | ios | Recalculate-all + pull-to-refresh + full invalidation | IOS-001, RECOMPUTE-001 |
| TASK-IOS-IMPORT-001 | ios | Statement import (blocked until web import ships) | IOS-001 |

**Start with `TASK-IOS-001` + `TASK-IOS-CHARTS-001`** (foundation), then `TASK-IOS-002`, then the
feature views in parallel.

---

## Recently completed

| ID | Title |
|----|-------|
| TASK-RECON-001 | Reconcile paired transfer legs (R1) |
| TASK-RECON-002 | Wire data-quality transfer-pair coverage (R2) |
| TASK-RECON-003 | Self-transfer fallback + unpaired signal (R3) |
| TASK-ANALYTICS-012 | Alert rule engine (table-driven, post-sync) |
| TASK-ANALYTICS-016 | Materialized marts + seasonally-adjusted category deltas |
| TASK-ANALYTICS-017 | Personal CPI + nominal vs real spending |
| TASK-ANALYTICS-019 | Investment behavior heuristics with evidence |
| TASK-ANALYTICS-020 | Planning engine (runway, payoff, goals, scenarios) |
| TASK-ANALYTICS-005 | dim_category spend-class / essential split |
| TASK-UI-PLAN-001 | Wire budgets panel: CRUD + accept suggestions + add-category |
| TASK-UI-PLAN-002 | Wire savings goals: CRUD + suggested-goals accept/edit/delete |
| TASK-UI-AUDIT-001 | Render full audit list + lapsed-subscription cards |
| TASK-SEC-002 | GDPR JSON data export (`GET /auth/export`) |
| TASK-IMPORT-006–008 | Import compliance, Wave 2 CSV, PDF plugins |
| TASK-IMPORT-001–005 | Full statement import pipeline |

---

## Verify

```bash
cd backend && npm run test:import   # 19 tests
cd backend && npm run test:export   # export secret scan
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/v1/auth/export -o spendflow-export.json
```

---

## iPhone app (deferred — P4)

No active work. See tasks `TASK-IOS-001`, `TASK-IOS-002`.
