# SpendFlow

> Personal finance intelligence platform — automatic bank sync, smart reconciliation, and actionable insights to help you understand where your money really goes.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-green)](https://fastify.dev/)
[![Plaid](https://img.shields.io/badge/Plaid-integrated-blueviolet)](https://plaid.com/)

---

## What is SpendFlow?

Most people have money scattered across checking accounts, savings accounts, and multiple credit cards. Existing tools like Mint required manual CSV exports or double-counted credit card payments as expenses. SpendFlow fixes this: connect all your accounts once via OAuth, and get a unified, reconciled view of your true net cash flow — automatically, every day.

The goal is simple: show you **where you're wasting money**, **where you're underspending on what matters**, and surface the patterns that are silently hurting your financial health.

---

## Repository layout

```
spendflow/
├── backend/            # Fastify API + BullMQ workers
│   ├── src/
│   │   ├── config/     # Env validation, categories
│   │   ├── db/         # Drizzle schema + migrations
│   │   ├── routes/     # HTTP route handlers
│   │   ├── services/   # Business logic (Plaid, auth, transactions)
│   │   └── lib/        # Shared utilities
│   └── scripts/        # One-off migration + import scripts
├── ui/                 # Next.js 15 web app
│   └── src/
│       ├── app/        # Pages (App Router)
│       ├── components/ # React components
│       ├── lib/        # API client, hooks
│       └── types/      # Shared TypeScript types
├── ios/                # SwiftUI iPhone app (Phase 4)
├── docs/
│   ├── design/         # Requirements, UX spec, API contract, design tokens
│   └── architecture/   # System overview, security, deployment, iOS patterns
└── .cursor/rules/      # AI + developer coding standards
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web UI | Next.js 15, React 19, TypeScript 5, Tailwind CSS v4 |
| iPhone | SwiftUI, Plaid Link iOS SDK (Phase 4) |
| API | Fastify 5, TypeScript 5, Zod validation |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Auth | JWT (access + refresh tokens), Google OAuth |
| Bank data | Plaid (Link, Transactions, Balance, Webhooks) |
| Charts | Chart.js 4 (web), Swift Charts (iOS) |
| Containers | Podman (rootless) |

---

## Features Built

### Authentication
- Email/password registration and login
- Google OAuth one-tap sign-in
- JWT access + refresh token rotation
- CCPA-compliant account deletion (cascading)

### Bank & Account Connectivity (Plaid)
- Connect 12,000+ US financial institutions via Plaid Link (OAuth, no credential sharing)
- Automatic daily transaction sync via Plaid webhooks
- Incremental sync using Plaid cursor (no duplicate transactions)
- Encrypted access token storage (AES-256 at rest)
- Account re-authentication flow for expired Plaid items
- Manual on-demand sync trigger per institution
- Supports: checking, savings, and credit card accounts

### Transaction Management
- Paginated transaction list with cursor-based pagination
- Filter by month, category, account, and transaction type
- Full-text search across merchant names and descriptions
- Multi-column sort (date, amount, name, category)
- Manual transaction re-categorization with per-merchant memory
- Sub-category support within primary categories
- CSV export of filtered transaction sets

### Transfer Reconciliation
- Automatically detects and neutralizes credit card payments between accounts
- Eliminates double-counting of savings transfers
- Produces accurate **true net cash flow** — not inflated by inter-account moves
- Money Flow view: Income → Bank Accounts → Credit Cards with monthly series

### Spending Analytics
- **Dashboard KPI cards**: total spent, income, net savings, savings rate, top category
- **Donut chart**: category breakdown with interactive drill-down
- **Trend chart**: month-over-month spending by category
- **Area + bar charts**: interactive, filterable time-series charts
- **Category analytics panel**: per-category totals with MoM delta indicators
- Month filter to compare any time range

### Spending Alerts & Insights
- High-spend category alerts (compared to prior months)
- Unusual transaction alerts
- Low savings rate warnings
- Severity levels: info, warning, danger
- Dismissible notifications via notification bell

### Household / Family Mode
- Owner can invite partners by email
- Partners link their own bank accounts
- Shared dashboard aggregates all household members' spending
- Scope filter: view All / Household / Personal spending
- Per-member color coding on charts
- Family view with member-level breakdown

### Accounts View
- All connected accounts in one dashboard
- Live balances (current + available) per account
- Institution name and last-synced timestamp
- Account status badges (active / error / reauth required)
- One-click Plaid Link to add new institutions

### Infrastructure
- BullMQ job queue for async Plaid sync (webhook-enqueued, idempotent)
- HMAC webhook signature verification
- Health endpoint with DB + Redis status checks
- Rate limiting: 100 req/min per authenticated user
- Structured logging (Pino)
- Zod validation on all API inputs and environment variables

---

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7
- Plaid developer account ([sign up free](https://dashboard.plaid.com/signup))

### Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL, REDIS_URL, PLAID_* vars
npm install
npm run db:migrate
npm run dev                   # starts on :4000
```

### Web UI

```bash
cd ui
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_PLAID_ENV
npm install
npm run dev                         # starts on :3002
```

### Database migrations

```bash
cd backend
npm run db:generate    # generate migration from schema changes
npm run db:migrate     # apply migrations
```

### Containers (Podman)

See [`docs/architecture/container-deployment.md`](docs/architecture/container-deployment.md) for full Podman stack configuration (PostgreSQL, Redis, backend, UI).

---

## API

Base URL: `http://localhost:4000/api/v1`

All protected routes require `Authorization: Bearer <accessToken>`. Money values are decimal strings (e.g. `"127.43"`). See [`docs/design/api-contract.md`](docs/design/api-contract.md) for the full contract.

**Key endpoints:**

| Group | Endpoint | Description |
|-------|----------|-------------|
| Auth | `POST /auth/google` | Google OAuth sign-in |
| Auth | `POST /auth/login` | Email/password login |
| Auth | `POST /auth/refresh` | Rotate access token |
| Plaid | `POST /plaid/link-token` | Start Plaid Link flow |
| Plaid | `POST /plaid/exchange-token` | Complete account connection |
| Transactions | `GET /transactions` | List with filters + pagination |
| Transactions | `GET /transactions/summary` | KPI totals for a date range |
| Transactions | `GET /transactions/by-category` | Category totals |
| Transactions | `GET /transactions/flow` | Money flow (income → bank → CC) |
| Transactions | `PATCH /transactions/:id/category` | Re-categorize a transaction |
| Transactions | `GET /transactions/export.csv` | CSV export |
| Insights | `GET /insights/alerts` | Smart spending alerts |
| Insights | `GET /insights/trends` | Category trends over time |
| Household | `GET /household` | Members and access role |
| Household | `POST /household/members/:id/invite` | Invite partner by email |
| Health | `GET /health` | DB + Redis status |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/design/product-requirements.md`](docs/design/product-requirements.md) | MVP scope, goals, personas, roadmap |
| [`docs/design/api-contract.md`](docs/design/api-contract.md) | REST contract (all clients) |
| [`docs/design/ui-ux-specification.md`](docs/design/ui-ux-specification.md) | Screen layouts and UX flows |
| [`docs/design/design-tokens.json`](docs/design/design-tokens.json) | Shared colors, categories (web + iOS) |
| [`docs/design/mobile-patterns.md`](docs/design/mobile-patterns.md) | iPhone UX: Keychain, Plaid, push |
| [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) | Stack, data model, integrations |
| [`docs/architecture/mobile-ios.md`](docs/architecture/mobile-ios.md) | iPhone architecture |
| [`docs/architecture/data-security-compliance.md`](docs/architecture/data-security-compliance.md) | Encryption, GDPR/CCPA |
| [`docs/architecture/container-deployment.md`](docs/architecture/container-deployment.md) | Podman deployment |

---

## Roadmap & Backlog

The items below are grouped by theme. Priorities were shaped by user needs and 2026 market research (Monarch Money, YNAB, Copilot, Empower, Quicken Simplifi benchmarks).

---

### 🧾 Ecommerce Return Reconciliation

> **Goal:** Detect when a bank credit is a refund for an online purchase and automatically link it back to the original transaction so your spending totals stay accurate.

| Feature | Description |
|---------|-------------|
| **Amazon order import** | Connect via Amazon's SP-API to pull order history and match refund credits on your card/bank to the originating Amazon order |
| **Return status tracking** | Show open returns, confirmed refunds, and pending credits per order with expected refund date |
| **Refund gap detection** | Alert when Amazon/merchant promised a refund but the credit hasn't appeared in your account after N days |
| **Shopify / retailer receipts** | Parse email receipts (Gmail integration) to identify online purchases and cross-reference with return credits |
| **Adjusted category totals** | Remove confirmed refunds from spending totals so category summaries reflect net actual spend, not gross |
| **Return rate insight** | Show your return rate per merchant — high return rates at a specific retailer could signal impulse-buying behavior |

**API integrations:** Amazon SP-API, Gmail API (receipt parsing), Plaid transaction matching

---

### 📈 Investment & Brokerage Analysis

> **Goal:** Pull in brokerage and retirement account transactions and surface behavioral patterns in your investment decisions — what's making you money, what's costing you.

| Feature | Description |
|---------|-------------|
| **Brokerage account sync** | Connect Fidelity, Schwab, Robinhood, ETRADE via Plaid Investments product to import trade history |
| **Realized P&L tracker** | Calculate actual profit and loss per position when sold, broken down by asset class, sector, and holding period |
| **Unrealized P&L dashboard** | Live portfolio view with current vs. cost basis per holding |
| **Behavioral pattern detection** | Identify recurring decision patterns: panic selling during market dips, buying peaks, overtrading sectors |
| **Holding period analysis** | Average hold time per ticker — show correlation between short holds and realized losses |
| **Tax lot tracking** | Short-term vs. long-term gain classification, estimated capital gains tax liability |
| **Dividend income tracking** | Separate dividend credits from spending income; show annualized yield per holding |
| **Retirement account progress** | 401(k) / IRA contribution pace vs. IRS annual limits; projected balance at retirement age |
| **Portfolio vs. spend correlation** | "On weeks when markets dropped > 2%, you spent 18% more on dining" — behavioral finance insights |
| **Time-Weighted Return (TWR)** | Performance metric that strips out the effect of your deposit/withdrawal timing |

**API integrations:** Plaid Investments, Alpaca, Polygon.io (market data)

---

### 🤖 AI Financial Coach

> **Goal:** A conversational assistant that answers questions about your own data and proactively surfaces insights you'd never think to look for.

| Feature | Description |
|---------|-------------|
| **Natural language Q&A** | "How much did I spend on food delivery last quarter?" answered from your actual transaction history |
| **Monthly narrative** | Auto-generated plain-English summary of the month: what changed, why, what to watch |
| **Subscription creep detector** | Identify recurring charges that grew, reactivated, or that you forgot about — surface average $80+/month in hidden charges |
| **Predictive cash flow** | 30–90 day forward-looking cash flow based on recurring transactions, paydays, and seasonal patterns |
| **Goal-aware coaching** | Set a savings goal; coach adjusts weekly insights to guide toward it |
| **Anomaly explanations** | When a category spikes, the AI explains likely causes before you have to dig |
| **Bill negotiation suggestions** | Flag high recurring bills (cable, insurance, subscriptions) with comparable market rates |
| **Privacy mode** | Option to run LLM locally via Ollama — no transaction data leaves your device |

**Stack:** OpenAI / Anthropic API or Ollama (local), RAG over transaction embeddings

---

### 💰 Budgeting & Goals

| Feature | Description |
|---------|-------------|
| **Per-category budgets** | Set monthly spend limits per category with real-time progress bars |
| **Budget alerts** | Push notification when you're 80% through a budget mid-month |
| **Savings goals** | Define a goal (vacation, emergency fund, down payment) with target amount and date; track progress |
| **Zero-based budget mode** | Allocate every dollar of income to a category or savings bucket |
| **Rolling budget carry-over** | Unspent budget from last month rolls into a buffer for this month |
| **Envelope simulation** | Drag-and-drop budget planner showing how different allocations affect savings rate |

---

### 🔔 Smart Alerts & Automation

| Feature | Description |
|---------|-------------|
| **Subscription manager** | Full list of all detected recurring charges; cancel button (deep links to account portal) |
| **Duplicate charge detection** | Flag when the same merchant charges the same amount twice within 48 hours |
| **Low balance warning** | Alert when any checking account drops below a user-defined threshold |
| **Paycheck arrived** | Notify when income is detected; auto-trigger a savings transfer suggestion |
| **Large transaction alert** | Instant push when a transaction exceeds a configurable threshold |
| **Unusual merchant alert** | Flag transactions from merchants you've never used before |
| **Spending velocity alert** | "You've spent 65% of your typical monthly budget in only 10 days" |

---

### 📊 Advanced Reporting & Net Worth

| Feature | Description |
|---------|-------------|
| **Net worth tracker** | Total assets (checking + savings + investments + real estate) minus liabilities (credit card balances + loans) over time |
| **Tax export** | Tag transactions as deductible (home office, medical, charity); export Schedule C / 1099 categories |
| **Year-over-year comparison** | "You spent $3,200 on restaurants this year vs. $2,700 last year — a 19% increase" |
| **Spending personality report** | Monthly archetype: "Foodie," "Homebody," "Traveler" based on category mix |
| **True annual cost calculator** | Show annual spend for recurring patterns (e.g., "Your daily coffee habit costs $1,460/year") |
| **Merchant loyalty analysis** | Top merchants by lifetime spend; identify where loyalty discounts or cashback cards would help most |
| **Savings rate trend** | Track savings rate month-by-month as a core financial health metric |

---

### 🏦 Credit & Debt Management

| Feature | Description |
|---------|-------------|
| **Credit card utilization tracker** | Monitor utilization ratio across all cards; alert before it harms credit score |
| **Credit score simulator** | Model FICO score impact of paying off a specific debt before doing it |
| **Debt payoff planner** | Avalanche vs. snowball comparison for all outstanding balances |
| **Interest cost calculator** | Show how much you're paying in interest per card per month |
| **Credit monitoring integration** | Connect to Experian / Equifax API to surface score changes and new inquiries |

---

### 📱 iPhone App (Phase 4)

| Feature | Description |
|---------|-------------|
| **Native SwiftUI app** | Full parity with web dashboard across 5 tab screens |
| **Face ID app unlock** | Biometric authentication for fast secure access |
| **Native Plaid Link iOS SDK** | In-app bank connection without leaving the app |
| **APNs push notifications** | Real-time alerts for large transactions, budget warnings, paycheck arrivals |
| **Keychain token storage** | Secure JWT refresh token in iOS Keychain |
| **Widgets** | Today widget showing net spend for the current month and top category |
| **Siri Shortcuts** | "Hey Siri, how much did I spend on food this week?" |

---

### 🔐 Security & Compliance

| Feature | Description |
|---------|-------------|
| **MFA / TOTP** | Optional two-factor authentication via authenticator app |
| **Behavioral biometrics** | Detect unusual login patterns (typing cadence, scroll behavior) |
| **Read-only bank access** | SpendFlow never writes to your bank accounts — view-only Plaid products only |
| **GDPR / CCPA export** | Download all your data as JSON; full account deletion with cascade |
| **Audit log** | Per-user log of all data access and account changes |
| **SOC 2 Type II path** | Compliance roadmap for enterprise / family plan expansion |

---

### 🌐 Open Banking Expansion

| Feature | Description |
|---------|-------------|
| **MX + Finicity fallback** | Alternative aggregators for institutions Plaid doesn't cover |
| **EU open banking (PSD2)** | Connect European banks via Tink or TrueLayer |
| **Crypto wallet tracking** | Connect Coinbase, Kraken wallets via their APIs; track realized gains from on-chain sells |
| **PayPal / Venmo / Cash App** | Import peer-to-peer transaction history and categorize social payments |

---

## Services

| Service | Folder | Runtime | Deploy |
|---------|--------|---------|--------|
| Web UI | `ui/` | Next.js 15 | Podman |
| iPhone | `ios/` | SwiftUI | App Store |
| API | `backend/` | Fastify 5 + TypeScript | Podman |
| Worker | `backend/` | BullMQ consumer | Podman (same image) |
| Database | — | PostgreSQL 16 | Podman |
| Cache / Queue | — | Redis 7 | Podman |

---

## Status

**Active development — Phase 2/3.** Core backend and web UI are functional. See [product-requirements.md](docs/design/product-requirements.md) for full phase breakdown.

- ✅ Phase 1: Auth, Plaid integration, DB schema, transaction sync
- ✅ Phase 2: Webhook receiver, BullMQ queue, reconciliation engine, categorization, dashboard UI
- 🔄 Phase 3: Categories page, smart alerts, CSV export, mobile responsive polish
- ⏳ Phase 4: iPhone app (SwiftUI)
- ⏳ Phase 5: AI coach, budgets, net worth, investment analysis

---

## Contributing

See [AGENTS.md](AGENTS.md) for AI agent guidelines and coding standards. Per-language rules live in `.cursor/rules/`.

- No `.env` files or secrets in commits
- Strict TypeScript — no `any`
- Validate all external input with Zod
- One concern per PR when possible
