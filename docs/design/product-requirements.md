# Product Requirements

**Product:** SpendFlow  
**Version:** 1.0  
**Status:** In Development (Phase 2 largely complete; Phase 3 in progress)  
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

**Current state:** Phase 1–2 complete. Phase 3 polish largely complete. **Phase 3.6 statement import** is the active track (UI upload shipped; parsers + worker next). Phase 4 iPhone **deferred**.

### Phase 3.6 — Statement import (active)

- [x] Import UI + encrypted upload API (`/accounts/import`, `/imports/*`)
- [x] CSV parsers: E*TRADE, Fidelity, Webull (day-trade Wave 1) + worker job
- [ ] OFX/QFX multi-account parser
- [ ] Import review UI (detected accounts)
- [ ] Plaid ↔ import merge + transaction dedup
- [ ] Blob retention, consent records, audit events
- [ ] Secondary brokers + PDF plugins

See [TASK_BOARD.md](../development/TASK_BOARD.md).

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
- [API contract](api-contract.md)
- [System overview](../architecture/system-overview.md)
- [Mobile iOS](../architecture/mobile-ios.md)
- [Data security & compliance](../architecture/data-security-compliance.md)
