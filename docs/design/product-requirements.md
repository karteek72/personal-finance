# Product Requirements

**Product:** SpendFlow  
**Version:** 1.0  
**Status:** In Development (Phase 3.6 complete; **Phase 3.7–3.9 analytics redesign active**)  
**Last Updated:** June 2026

> **Active backlog:** in-flight work and agent task claims are tracked in [`docs/development/TASK_BOARD.md`](../development/TASK_BOARD.md).

---

## Executive Summary

SpendFlow is a personal finance intelligence platform that automatically aggregates transactions from credit cards, checking accounts, and savings accounts via live bank API integrations. It eliminates manual CSV exports by connecting to 12,000+ US financial institutions through Plaid. The platform reconciles money flow between bank accounts and credit cards, categorizes transactions, and surfaces actionable spending insights.

---

## Problem Statement

### Core pain points

- Manual CSV download from each bank/card portal is tedious and only done retrospectively
- Credit card payments from checking appear as expenses in naive tools, double-counting spend
- No single source of truth for multi-card, multi-bank households
- Existing tools (Mint, YNAB) have weak reconciliation and insight quality
- Users cannot see true net cash flow after inter-account transfers are stripped out

See [user-personas-and-scenarios.md](user-personas-and-scenarios.md) for target users and daily flows.

---

## Product Goals

1. **Zero-friction data ingestion** — connect all accounts in under 3 minutes via OAuth, no CSV exports
2. **True money flow** — reconcile CC payments and savings transfers so net spending is accurate
3. **Actionable insights** — highlight overspending categories with month-over-month deltas
4. **Timely data** — transaction refresh daily (or on-demand) via webhooks
5. **Honest analytics** — every KPI tagged factual/heuristic/external with confidence; no fabricated metrics

### Analytics KPI domains (Phase 3.7–3.9)

Ten intelligence domains, each with defined formulas and API envelopes — see [analytics-architecture.md](../architecture/analytics-architecture.md):

| # | Domain | Example KPIs |
|---|--------|--------------|
| 1 | Cash flow | Net cash flow, burn rate, free cash flow, income stability |
| 2 | Spending behavior | Fixed/variable/discretionary split, volatility, merchant HHI, category trends |
| 3 | Budgeting & variance | Budget vs actual, safe-to-spend, suggested budgets |
| 4 | Savings & liquidity | Cash savings rate (canonical 0–1), net-investment rate, emergency-fund months |
| 5 | Debt health | Credit utilization (real limit only), DTI, payoff ETA |
| 6 | Investment performance & behavior | Unrealized/realized P/L, XIRR, TWR, fee drag, behavioral flags |
| 7 | Inflation & cost-of-living | Personal CPI, nominal vs real spend, BLS compare |
| 8 | Resilience | Composite score + liquidity, income stability, expense flexibility |
| 9 | Goals & planning | Runway, goal pace, surplus allocation, scenarios |
| 10 | Data quality | Categorization coverage, sync freshness, transfer-pair coverage, reconciliation gap |

**Composite scores:** Financial Health (7 sub-scores) and Resilience (5 sub-scores) replace the first-gen wellness model. Heuristic brokerage-behavior signals require confidence + evidence.

**API surface:** consolidated under `GET /analytics/*` with metric envelopes and paginated tabular sub-resources — see [api-contract.md](api-contract.md).

### Success metrics (KPIs)

| Metric | Target |
|--------|--------|
| Account connection success rate | ≥ 95% |
| Time-to-first-insight after signup | < 5 minutes |
| DAU / MAU | ≥ 40% |
| Avg accounts connected per user | ≥ 4 |
| Transaction auto-categorization accuracy | ≥ 88% |

---

## Feature Scope

### MVP (launch)

- [x] Plaid integration for US banks & credit cards
- [x] OAuth-based account linking (no credential sharing)
- [x] Transaction sync via webhooks (daily refresh)
- [x] Auto-categorization (rule engine + Plaid categories, 15 categories)
- [x] Inter-account transfer reconciliation (CC payments, savings moves)
- [x] Dashboard: KPI cards, trend charts, donut category breakdown
- [x] Money Flow view (Income → Bank → CC)
- [x] Spending alerts (high category spend, subscription creep, low savings rate)
- [x] Transaction search, filter, manual re-categorization (with per-merchant memory)
- [x] CSV export
- [x] Dark/light mode
- [x] Mobile-responsive (375px+)

### Data ingestion strategy (planned)

Two onboarding paths to control Plaid cost and maximize history depth — see [statement-import-and-plaid-bridge.md](../architecture/statement-import-and-plaid-bridge.md):

- [x] **Import UI (Phase A)** — `/accounts/import` wizard; multipart upload; AES-256-GCM encrypted storage
- [x] **CSV parsers + worker (Wave 1)** — E*TRADE, Fidelity, Webull → `investment_transactions`
- [ ] **Statements first** — bulk upload 5–10 years of monthly **QFX/OFX, CSV, or PDF**; parser auto-identifies account from file content
- [ ] **All account types** — checking, savings, credit cards, brokerage (day/swing trades), IRA/401k; banking → `transactions`, trades → `investment_transactions`
- [ ] **High-volume brokerage** — batch worker for thousands of trades per monthly statement
- [ ] **Plaid first** — direct Link for users with ≤10 accounts who accept ~24 months of history
- [ ] **Smart merge** — when Plaid links after import, match accounts by institution + mask + type; dedup transactions by fingerprint; upsert only net-new Plaid rows

Parser spec: [import-parser-design.md](../architecture/import-parser-design.md). CLI prototype: `npm run import:statements` (QFX + BofA PDF only today).

### V2 (post-launch)

- [ ] MX & Finicity as fallback aggregators
- [ ] Investment account aggregation
- [ ] Budget setting per category with alert thresholds
- [ ] AI spending coach (LLM Q&A over your data)
- [ ] Recurring subscription detector
- [ ] Net worth tracker
- [ ] Tax export (Schedule C, 1099 category tagging)
- [x] Multi-user household mode (invites, partner sign-in, shared dashboard)

### iPhone app (deferred — lowest priority)

Native SwiftUI app sharing the same backend API — see [mobile-ios.md](../architecture/mobile-ios.md). **No active development** until statement import (Phase 3.6) is usable on web.

- [ ] Auth + Keychain session
- [ ] Tab navigation (5 screens)
- [ ] Native Plaid Link iOS SDK
- [ ] Push notifications (APNs)
- [ ] Face ID app unlock
- [ ] App Store release

---

## Development Phases

**Current state:** Phase 1–2 complete. Phase 3 polish largely complete. Phase 3.6 statement import complete. **Phase 3.7–3.9 analytics intelligence redesign is the active track.**

### Phase 3.7 — Analytics foundation (P1, active)

Must-have correctness and infrastructure:

- [ ] Canonical `signed_amount` on transactions; single metric layer (`services/metrics/*`)
- [ ] Real credit limits (Plaid liabilities); remove fabricated utilization
- [ ] Balance + holdings + security price snapshots on every sync; net-worth pipeline
- [ ] `dim_category` spend-class split; rebuild Financial Health composite
- [ ] `GET /analytics/overview`, `/cashflow`, `/data-quality`; paginated `/analytics/merchants`
- [ ] Frontend: savingsRate 0–1 convention, UTC date fixes, loading/empty guards, confidence badges

### Phase 3.8 — Analytics depth (P2)

- [ ] Merchant normalization (`dim_merchant`); recurring engine v2; transfer pairing + refund netting
- [ ] Resilience composite + alert engine; materialized marts + seasonal category deltas
- [ ] Investment snapshots + FIFO tax lots; realized/unrealized P/L, XIRR, dividend/fee/cash drag
- [ ] Personal CPI; paginated list endpoints (money-flow, inflation categories, subscriptions, holdings)
- [ ] Reusable `DataTable` component with URL-mirrored sort/filter/page state

### Phase 3.9 — Advanced analytics (P3)

- [ ] TWR, benchmark delta, max drawdown; investment behavior heuristics with evidence
- [ ] Planning engine (runway, payoff sim, scenarios, surplus allocation)
- [ ] Honest Spending DNA; lifestyle cost-audit engine; subscription lifecycle (lapsed/cancelled)

See [analytics-architecture.md](../architecture/analytics-architecture.md) and [TASK_BOARD.md](../development/TASK_BOARD.md).

### Phase 3.6 — Statement import ✅

- [x] Import UI + encrypted upload API (`/accounts/import`, `/imports/*`)
- [x] CSV parsers: E*TRADE, Fidelity, Webull (day-trade Wave 1) + worker job
- [x] OFX/QFX multi-account parser (where shipped)
- [x] GDPR export (`GET /auth/export`)

### Phase 3 — Polish & Launch — largely complete

- [x] Categories page + transaction table
- [x] Smart alerts engine
- [x] CSV export
- [x] Mobile responsive
- [x] Reconnect flow for expired Plaid items
- [ ] Production Plaid approval
- [ ] Monitoring (Sentry, structured logs)

### Phase 1 — Foundation (Weeks 1–4) ✅

- [x] Project scaffold: `ui/` (Next.js 15) + `backend/` (Fastify)
- [x] Auth system
- [x] Plaid Sandbox: Link → exchange token → fetch accounts
- [x] Database schema + Drizzle migrations
- [x] Basic transaction sync (polling first)

### Phase 2 — Core Product (Weeks 5–8) ✅

- [x] Webhook receiver + BullMQ queue
- [x] Incremental sync with Plaid cursor
- [x] Reconciliation engine
- [x] Auto-categorization pipeline
- [x] Dashboard UI + Money Flow page

### Phase 4 — iPhone (deferred — lowest priority)

Partial shell in `ios/`. **Not scheduled** until Phase 3.6 statement import is usable on web.

- [ ] iOS shell: auth, Keychain, tab navigation (partial)
- [ ] Dashboard + transactions (read-only) (partial)
- [ ] Native Plaid Link (partial)
- [ ] All five screens at parity with web
- [ ] APNs push for alerts
- [ ] App Store submission

### Phase 5 — V2 (Weeks 17+)

- [ ] Fallback aggregators, AI coach, budgets, net worth, subscriptions
- [ ] EU data region + open banking expansion

---

## Open Questions

1. **Multi-user vs personal** — single-user app or multi-tenant SaaS? Affects auth, RLS, Plaid plan.
2. **Plaid production account** — confirm acceptable for personal vs SaaS use.
3. **AI coach (V2)** — cloud LLM vs local Ollama for privacy.
4. **Hosting** — Podman self-hosted (preferred) vs managed PaaS for dev/staging.
5. **Mobile** — SwiftUI iPhone app decided but **deferred (P4)** until statement import ships on web. See [mobile-ios.md](../architecture/mobile-ios.md).
6. **Data residency** — single region initially; `users.data_region` for future EU split. See [data-security-compliance.md](../architecture/data-security-compliance.md).

---

## Related documents

- [Design system](design-system.md)
- [Design tokens (JSON)](design-tokens.json)
- [Mobile patterns](mobile-patterns.md)
- [Analytics architecture](../architecture/analytics-architecture.md)
- [API contract](api-contract.md)
- [System overview](../architecture/system-overview.md)
- [Mobile iOS](../architecture/mobile-ios.md)
- [Data security & compliance](../architecture/data-security-compliance.md)
