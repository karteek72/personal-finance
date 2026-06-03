# SpendFlow mock database seed

Deterministic demo data for exercising the **real backend API** and **UI** (`NEXT_PUBLIC_USE_MOCKS=false`).

## Scenarios covered

| Area | What is seeded |
|------|----------------|
| Dashboard / summary | May 2026 spend, income, transfers, savings rate |
| Transactions | List, filters, pagination, pending row, subcategories |
| Categories / charts | Multi-category spend across Jan–May 2026 |
| Trends | Monthly totals via `monthly-spend.json` |
| Alerts | MoM dining/subscription spikes, pending txn, overdue Amex |
| Accounts | 3 credit + checking + savings; Plaid + import sources |
| Liabilities | Statement balances, due dates, one overdue card |
| Household | Owner + linked partner + child placeholder member |
| Invitations | Pending invite for child member (`seed-invite-sam-demo-token`) |
| Merchant rules | Whole Foods, Uber Eats, Netflix |
| Transfers | Internal transfer + credit card payment excluded from spend |

## Files

- `manifest.json` — version, user emails, file map
- `users.json` — dev + partner users (fixed UUIDs)
- `accounts.json` — five accounts (stable IDs for UI parity)
- `plaid-items.json` — sandbox-style items (tokens encrypted at seed time)
- `transactions-may.json` — primary month (backend category names)
- `monthly-spend.json` — Jan–Apr totals expanded into transactions
- `merchant-category-rules.json`
- `credit-card-liabilities.json`
- `household.json` — members, assignments, invitation

## Load into Postgres

From repo root (Postgres running, `.env` with `DATABASE_URL`):

```bash
cd backend
npm run db:seed
```

Options:

- Default: delete seed users (`personal@spendflow.local`, `partner@spendflow.local`) and reload
- `npm run db:seed -- --no-reset` — upsert without deleting users first

## Dev API + UI

**Backend** (repo root `.env` only — not `ui/.env.local`):

```env
AUTH_ALLOW_DEV_USER=true
```

Restart the backend after changing this (`npm run dev` in `backend/`).

**UI** (`ui/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_USE_MOCKS=false
```

Restart `npm run dev` in `backend/` and `ui/`. The API attaches requests to `personal@spendflow.local` when dev auth is enabled.

## Users

| Email | Role |
|-------|------|
| `personal@spendflow.local` | Owner; all accounts and transactions |
| `partner@spendflow.local` | Linked partner household member |
