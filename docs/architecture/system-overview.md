# System Overview

**Product:** SpendFlow  
**Last Updated:** June 2026

---

## Architecture diagram

```
┌─────────────┐     HTTPS      ┌─────────────────┐
│   Browser   │ ──────────────►│  ui (Next.js)   │
└─────────────┘                └────────┬────────┘
                                        │ REST /api/v1
┌─────────────┐                ┌────────▼────────┐
│  iPhone App │ ──────────────►│ backend (Fastify)│
│  (SwiftUI)  │                │  :4000          │
└──────┬──────┘                └────────┬────────┘
       │ Plaid Link (iOS SDK)           │
       │                                │
       └───────────────────────────────►│
         Plaid Link (web SDK via ui/)   │
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
             ┌──────▼──────┐    ┌───────▼──────┐   ┌───────▼──────┐
             │ PostgreSQL  │    │    Redis     │   │    Plaid     │
             │             │    │   BullMQ     │   │     API      │
             └─────────────┘    └──────────────┘   └──────────────┘
                                       │
                                ┌──────▼──────┐
                                │   worker    │
                                │ (sync jobs) │
                                └─────────────┘
```

See [mobile-ios.md](mobile-ios.md) for iPhone-specific details.

---

## Technology stack

| Layer | Technology | Location |
|-------|-----------|----------|
| Web UI | Next.js 15, React 19, TypeScript 5.x, Tailwind v4 | `ui/` |
| iPhone | SwiftUI, Plaid Link iOS SDK | `ios/` |
| API | Fastify 5, TypeScript 5.x, Zod | `backend/` |
| ORM | Drizzle ORM | `backend/` |
| Database | PostgreSQL 16 | Container → cloud migration |
| Queue | BullMQ + Redis 7 | Container |
| Auth | JWT (access + refresh) | `backend/` |
| Bank data | Plaid (Transactions, Link, Webhooks) | `backend/` + Link SDK in clients |
| Charts | Chart.js 4 (web), Swift Charts (iOS) | per client |

---

## Open banking (Plaid)

### Products used

| Product | Purpose |
|---------|---------|
| Link | OAuth account connection (UI SDK) |
| Transactions | Sync with cursor |
| Balance | Account balances |
| Webhooks | Push updates to backend |

### Connection flow

```
User → Plaid Link (UI) → public_token → POST /plaid/exchange-token (backend)
  → encrypted access_token stored → initial sync queued → webhooks registered
```

### Webhook events

- `TRANSACTIONS_INITIAL_UPDATE`, `TRANSACTIONS_DEFAULT_UPDATE`, `TRANSACTIONS_HISTORICAL_UPDATE` → queue sync job
- `TRANSACTIONS_REMOVED` → queue removal job
- `ITEM_ERROR` → mark item `reauth_required`, notify user

---

## Reconciliation engine

Core logic in `backend/src/services/reconciliation/`.

**Transfer detection:** Pattern match on description + cross-account amount/date matching (±$5, ±3 days).

**Money flow model:**

```
True Net Cash Flow = Gross Income
                   − Direct Expenses (non-CC depository debits)
                   − Credit Card Charges
                   [CC payments excluded]
                   [Savings transfers excluded]
```

| Type | Included in spend? |
|------|-------------------|
| Salary / interest | No (income) |
| CC charge | Yes |
| CC payment from bank | No (transfer) |
| Savings transfer | No (transfer) |
| Bank fee | Yes |

---

## Categorization pipeline

1. Plaid native categories (base signal)
2. Merchant rule engine (curated JSON map)
3. User override (permanent precedence)
4. ML classifier (V2)

**15 categories:** Food & Groceries, Dining, Transport, Entertainment, Shopping, Utilities, Health, Travel, Subscriptions, Home & Rent, Education, Personal Care, Financial, Income, Transfers.

---

## Database schema (core)

```sql
users (
  id, email, password_hash,
  country_code,                  -- ISO 3166-1 alpha-2
  data_region DEFAULT 'us',      -- residency routing for cloud migration
  created_at
)

plaid_items (
  id, user_id, plaid_item_id, access_token_encrypted,
  access_token_key_id,           -- KMS key version (envelope encryption)
  institution_id, institution_name, status, last_synced_at, cursor, created_at
)

accounts (
  id, user_id, plaid_item_id, plaid_account_id, name, official_name,
  type, subtype, mask, balance_current, balance_available, currency_code, is_active
)

transactions (
  id, user_id, account_id, plaid_transaction_id, date, name, merchant_name,
  amount, currency_code, category, plaid_category, transaction_type,
  is_transfer, transfer_pair_id, pending, user_category_override, created_at,
  signed_amount                    -- GENERATED: expense negative, income positive (Phase 3.7)
)
```

Indexes: `(user_id, date DESC)`, `(user_id, category)`, `(account_id)`.

Row-level security: all queries scoped by `user_id`.

### Analytics data model (Phase 3.7–3.9)

Canonical dimensions, time-series snapshots, and pairing tables support the metric layer described in [analytics-architecture.md](analytics-architecture.md). All are `user_id`-scoped with cascade deletes unless noted.

| Table | Purpose |
|-------|---------|
| `dim_category` | Spend taxonomy: `spend_class` (fixed/variable/discretionary/income/transfer), `is_essential`, `cpi_weight_eligible` |
| `dim_merchant` | Normalized merchant identity per user (`canonical_key`, `display_name`); `transactions.merchant_id` FK |
| `balance_snapshots` | Daily account balance + credit limit per sync — unlocks net-worth trend, historical utilization |
| `security_prices` | Daily close price per security |
| `holdings_snapshots` | Daily quantity, market value, cost basis per account/security — unlocks TWR, drawdown |
| `transfer_links` | Paired bank↔bank, bank↔brokerage, CC-payment legs with `match_confidence` |
| `tax_lots` | FIFO cost basis for realized/unrealized P/L |

**Snapshot pipeline:** on every account sync (Plaid, Teller, SnapTrade, import confirm), the worker upserts all three snapshot tables idempotently keyed by `as_of_date`. Until this pipeline runs, net-worth trend, TWR, drawdown, and historical utilization are structurally unavailable.

**Materialized marts:** PostgreSQL materialized views refreshed `CONCURRENTLY` at end of sync (`refresh-marts` BullMQ step). Current month stays live (raw queries); closed months read from marts:

| Mart | Grain |
|------|-------|
| `mart_cashflow_month` | Monthly income, outflow, net by user |
| `mart_category_month` | Category spend + seasonally adjusted deltas |
| `mart_net_worth_month` | Assets − liabilities trend |
| `mart_portfolio_daily` | Holdings value, contributions, returns |
| `mart_recurring` | Detected subscription/bill series |

**Metric layer:** `backend/src/services/metrics/*` — one function per KPI, returns the [metric envelope](../design/api-contract.md#metric-envelope). Composites (Health, Resilience) consume L2 metrics only.

Compliance tables: `consent_records`, `audit_events`, `devices`, `deleted_users` — see [data-security-compliance.md](data-security-compliance.md).

### Feature tables (analytics & planning)

These back the advanced features and the demo dataset. All are `user_id`-scoped with cascade
deletes; money is `numeric(12,2)`. Several response shapes (money calendar, daily forecast,
day-of-week averages, leak fee rollups, current net-worth totals) are **derived in services**
from transactions + recurring + accounts and are intentionally not stored.

| Domain | Tables |
|--------|--------|
| Investments | `securities`, `holdings`, `investment_transactions` |
| Wealth / planning | `net_worth_snapshots`, `budgets`, `savings_goals`, `recurring_series`, `fire_profiles` |
| Insights / behavioral | `wellness_scores`, `spending_dna`, `spending_patterns`, `transaction_reasons`, `challenges`, `habit_streaks`, `lifestyle_habits` |
| Protect | `inflation_profiles`, `inflation_categories`, `resilience_profiles`, `resilience_scenarios` |
| Coach / Wrapped | `coach_insights`, `wrapped_summaries` |

`accounts.type` now also includes `investment` with subtypes `brokerage \| 401k \| ira \| roth_ira \| hsa \| crypto`.

Read services: `investments-store.ts`, `planning-store.ts`, `insights-store.ts`, `protect-store.ts`, `coach-store.ts`. The deterministic demo dataset is generated by `backend/scripts/generate-mock-dataset.ts` (`npm run db:gen-mock`) and loaded via `npm run db:seed`.

---

## Security

| Requirement | Implementation |
|-------------|----------------|
| No bank credentials stored | Plaid OAuth only |
| Token encryption at rest | AES-256-GCM |
| TLS in transit | TLS 1.3 |
| Webhook verification | Plaid HMAC-SHA256 |
| Sessions | JWT RS256 or HS256, 24h access, refresh rotation |
| Rate limiting | 100 req/min/user via Redis |
| Secrets | Environment variables only |

Regulatory: CCPA delete via `DELETE /users/me`; GDPR consent/erasure/portability — see [data-security-compliance.md](data-security-compliance.md).

---

## Environment variables

See `backend/.env.example` (planned) and `ui/.env.example` (planned).

**Backend-only:** `DATABASE_URL`, `REDIS_URL`, `PLAID_SECRET`, `ENCRYPTION_KEY`, `JWT_SECRET`  
**UI-only:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PLAID_ENV`  
**iOS-only:** API base URL in Xcode build config — no Plaid secret on device

---

## Related documents

- [API contract](../design/api-contract.md)
- [Analytics architecture](analytics-architecture.md)
- [Mobile iOS](mobile-ios.md)
- [Data security & compliance](data-security-compliance.md)
- [Container deployment](container-deployment.md)
- [Repository layout](repository-layout.md)
