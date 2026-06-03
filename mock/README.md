# SpendFlow demo dataset

Deterministic demo data for exercising the **real backend API** (`npm run db:seed`) and the
**UI mock-mode** (`NEXT_PUBLIC_USE_MOCKS=true`). Both pipelines are generated from a single
seeded-RNG script so the two stay numerically identical.

## Source of truth

Everything here is **generated** — do not hand-edit. Regenerate with:

```bash
cd backend
npm run db:gen-mock     # writes mock/*.json AND ui/src/mocks/*.json
```

The generator (`backend/scripts/generate-mock-dataset.ts`) builds one persona — a dev user +
partner household, 11 accounts, ~14 months of transactions (Apr 2025 → Jun 2026, ~1,050 rows)
with edge cases — and derives every feature fixture from that transaction stream so budgets,
goals, net-worth snapshots, recurring, wellness, inflation, resilience, FIRE, coach and wrapped
all reconcile with the ledger.

## Scenarios covered

| Area | What is seeded |
|------|----------------|
| Dashboard / summary | Current-month spend, income, transfers, savings rate |
| Transactions | List, filters, pagination, pending rows, refunds, duplicates, large/unusual txns |
| Accounts | Checking, savings, cash, 3 credit (one overdue), brokerage, Roth IRA, 401k, crypto, HSA |
| Liabilities | Statement balances, minimum due, last payment, one overdue card |
| Investments | Securities, holdings, buys/sells/dividends, 401k + IRA contributions |
| Wealth | Net-worth snapshots (14 months), FIRE profile |
| Planning | Category budgets, savings goals, recurring series (one price increase), money calendar, daily forecast |
| Insights | Wellness score + dimensions, spending DNA, day-of-week + detected patterns, behavioral creep, reasons, challenges, streaks, lifestyle habits |
| Protect | Personal inflation profile + category basket, resilience runway + shock scenarios |
| Coach / Wrapped | Narrative, Q&A, 30-day forecast, year-in-review summary |
| Household | Owner + linked partner + child placeholder member + pending invite |
| Merchant rules | Whole Foods, Uber Eats, Netflix, etc. |
| Transfers | Internal transfer + credit-card payment excluded from spend |

## Files

`manifest.json` lists the full file map and seed users. Highlights:

- `users.json`, `accounts.json`, `plaid-items.json`, `household.json`, `merchant-category-rules.json`, `credit-card-liabilities.json`
- `transactions.json` — single unified ledger (Apr 2025 → Jun 2026)
- Investments: `securities.json`, `holdings.json`, `investment-transactions.json`
- Wealth/planning: `net-worth-snapshots.json`, `budgets.json`, `savings-goals.json`, `recurring-series.json`, `fire-profile.json`
- Insights: `wellness-scores.json`, `spending-dna.json`, `spending-patterns.json`, `transaction-reasons.json`, `challenges.json`, `habit-streaks.json`, `lifestyle-habits.json`
- Protect: `inflation-profile.json`, `inflation-categories.json`, `resilience-profile.json`, `resilience-scenarios.json`
- Coach/Wrapped: `coach-insights.json`, `wrapped-summaries.json`

The matching `ui/src/mocks/*.json` files are the **derived API response shapes** (already
aggregated/formatted) that the UI mock-api serves directly.

## Load into Postgres (full backend)

From repo root (Postgres running, `.env` with `DATABASE_URL`):

```bash
cd backend
npm run db:seed
```

Options:

- Default: delete seed users (`personal@spendflow.local`, `partner@spendflow.local`) and reload
- `npm run db:seed -- --no-reset` — upsert without deleting users first

### Backend + UI against Postgres

**Backend** (repo root `.env`):

```env
AUTH_ALLOW_DEV_USER=true
```

**UI** (`ui/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_USE_MOCKS=false
```

Restart `npm run dev` in both `backend/` and `ui/`. The API attaches requests to
`personal@spendflow.local` when dev auth is enabled.

## UI mock-mode (no backend / shareable demo)

For a zero-backend, shareable build (e.g. validating the idea with reviewers via a URL), set:

```env
# ui/.env.local
NEXT_PUBLIC_USE_MOCKS=true
```

The UI then reads `ui/src/mocks/*.json` directly through `ui/src/lib/mock-api.ts`; no database
or Plaid credentials are required. `npm run build` in `ui/` produces a static-ish bundle that can
be deployed anywhere. Every page and preview panel is fully clickable in this mode.

## Users

| Email | Role |
|-------|------|
| `personal@spendflow.local` | Owner; all accounts and transactions |
| `partner@spendflow.local` | Linked partner household member |
