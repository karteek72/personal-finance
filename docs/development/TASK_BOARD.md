# Development Task Board

**Last updated:** 2026-06-07  
**Source of truth:** [`tasks.yaml`](tasks.yaml)  
**CLI:** `npm run task -- <command>` from repo root

---

## Status summary

| Status | Count |
|--------|------:|
| done | 20 |
| ready | 13 |
| backlog | 11 |

**Statement import + GDPR export: complete.**

**Active focus:** Analytics intelligence redesign (Phase 3.7–3.9). The first-gen
analytics layer shipped fabricated/duplicated/stubbed metrics; see
[`../architecture/analytics-architecture.md`](../architecture/analytics-architecture.md)
for the audit, taxonomy, data model, and scoring frameworks. Tasks are scoped for
**parallel** work by independent agents.

**Next:** iOS at P4 (`TASK-IOS-001`, `TASK-IOS-002`).

---

## Analytics redesign (Phase 3.7–3.9)

Claim with `npm run task -- claim <ID> <agent-name>`. Honesty rule: heuristic/external
metrics must ship with a confidence + caveat — never present an inference as fact.

### Phase 3.7 — foundation (P1, must-have)

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-ANALYTICS-001 | backend | Canonical `signed_amount` + indexes | — |
| TASK-ANALYTICS-002 | backend | Metric layer (`services/metrics`) + envelope | 001 |
| TASK-ANALYTICS-003 | backend | Real credit limit; real utilization | — |
| TASK-ANALYTICS-004 | backend | `balance_snapshots` + net-worth pipeline | — |
| TASK-ANALYTICS-005 | backend | `dim_category` spend-class / essential split | 002 |
| TASK-ANALYTICS-006 | backend | Remove fabricated metrics; rebuild Health | 002,003,004 |
| TASK-ANALYTICS-007 | backend | Data-quality / confidence endpoint | 002 |
| TASK-UI-ANALYTICS-001 | ui | Normalize `savingsRate` scale + contract | — |
| TASK-UI-ANALYTICS-002 | ui | Fix UTC off-by-one dates | — |
| TASK-UI-ANALYTICS-003 | ui | Loading/empty guards + div0/NaN | — |
| TASK-UI-ANALYTICS-004 | ui | Surface `isLive` badges | — |
| TASK-DOCS-ANALYTICS-001 | docs | Sync api-contract / system-overview / PRD | — |

### Phase 3.8 — advanced (P2, high-value)

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-ANALYTICS-008 | backend | Merchant normalization + `dim_merchant` | — |
| TASK-ANALYTICS-009 | backend | Recurring engine v2 (creep/zombie/duplicate) | 008 |
| TASK-ANALYTICS-010 | backend | Transfer pairing + refund netting | 001 |
| TASK-ANALYTICS-011 | backend | Resilience composite score | 002,004 |
| TASK-ANALYTICS-012 | backend | Alert rule engine | 002,009 |
| TASK-ANALYTICS-013 | backend | Investment snapshots (prices + holdings) | — |
| TASK-ANALYTICS-014 | backend | Tax lots (FIFO) realized/unrealized P/L | 013 |
| TASK-ANALYTICS-015 | backend | XIRR + dividend trend + fee/cash drag | 013 |
| TASK-ANALYTICS-016 | backend | Materialized marts + seasonal deltas | 001,005,008 |
| TASK-ANALYTICS-017 | backend | Personal CPI + nominal vs real | 009,010 |
| TASK-UI-ANALYTICS-005 | ui | FIRE math + inflation/time-machine copy | — |
| TASK-UI-ANALYTICS-006 | ui | Preserve category deltas + chart fixes | — |
| TASK-UI-ANALYTICS-007 | ui | Consolidate money formatters | — |

### Phase 3.9 — advanced intelligence (P3)

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-ANALYTICS-018 | backend | TWR + benchmark + max drawdown | 013 |
| TASK-ANALYTICS-019 | backend | Behavior heuristics w/ evidence + confidence | 014,018 |
| TASK-ANALYTICS-020 | backend | Planning engine (runway/payoff/scenarios) | 002,011 |

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
| TASK-THINCLIENT-001 | backend | Move residual UI calculations to backend | A-002 |

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
| TASK-CALC-013 | P2 | backend | C4 wellness history reuses current balances (needs A-004) |
| TASK-UI-CALC-001 | P2 | ui | U1 income-by-month chart has no axes/values/tooltip |

**Parallelizable now (no deps):** every C-series task except CALC-013 (blocked by A-004).

### Intelligent budgets & savings goals

Budgets only auto-suggest when none configured (top-10, vanish on first save); savings goals are
display-only and never auto-created; `/planning/*` is read-only so the "+ Add" buttons do nothing.
Add CRUD + smarter, additive suggestions, all server-side. Design: `analytics-architecture.md` §12.

| ID | Area | Title | Deps |
|----|------|-------|------|
| TASK-PLAN-001 | backend | Budget & goal CRUD endpoints + schema (source/kind/status) | — |
| TASK-PLAN-002 | backend | Smarter additive budget suggestions (more categories, robust baseline) | PLAN-001 |
| TASK-PLAN-003 | backend | Auto-generate suggested savings goals from data | PLAN-001 |
| TASK-UI-PLAN-001 | ui | Wire budgets panel: CRUD + accept suggestions + add-category | PLAN-001/002 |
| TASK-UI-PLAN-002 | ui | Wire savings goals: CRUD + suggested-goals accept/edit/delete | PLAN-001/003 |

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
| TASK-UI-AUDIT-001 | ui | Render full audit list + lapsed-subscription cards | AUDIT-001/002 |

Related: `TASK-CALC-010` (C14) and `TASK-CALC-011` (C15) share root causes — coordinate.

---

## Recently completed

| ID | Title |
|----|-------|
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
