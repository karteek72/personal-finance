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

**Parallelizable now (no deps):** 001, 003, 004, 008, 013, all UI tasks, and the docs task.

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
