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

### Accounts & Debt View
- All connected accounts in one dashboard, **grouped by type** (Checking, Savings, Cash & Other, Credit Cards, Trading & Investments) with per-group totals
- Live balances (current + available) per account
- **Per-tile credit/liability detail** (merged from the former Debt page): statement balance, minimum due + due date, last payment, APR, est. interest — revealed progressively as Plaid syncs
- A debt-totals KPI strip appears when credit accounts exist (total balance, statement, min due, utilization)
- Status shown as **icons with tooltips** in the card header (Live / Imported / Reconnect required / Sync error / Overdue) plus last-synced date
- Icon-first header actions (cash flow, refresh all, add account) and one-click Plaid Link to add new institutions

### Web App Navigation (Information Architecture)
- Single **sectioned sidebar** (Overview · Money · Insights · Family) — no separate "Preview" group
- Related roadmap features are consolidated into **tabbed hubs**: Plan, Wealth, Insights, Protect (see [ui/STRUCTURE.md](ui/STRUCTURE.md))
- Spend is tabbed (Overview / Merchants / Patterns); legacy routes redirect (`/flow` → `/categories`, `/debt` → `/accounts`)
- Roadmap concepts ship as interactive **preview** mockups; sections still on illustrative data carry an amber banner, while Net Worth and Investments are wired to real balances
- Global UI: a floating **Coach** assistant and a seasonal **Wrapped** year-in-review banner

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

### Environment (single file)

```bash
cp .env.example .env    # repo root — backend, UI, and Podman all read this file
```

### Backend + UI (from repo root)

```bash
npm install --prefix backend && npm install --prefix ui
npm run db:migrate

# Full dev stack (Postgres + Redis in Podman, API + UI on host):
npm run dev

# Or run services separately (infra already running):
npm run dev:api
npm run dev:worker   # BullMQ: Plaid sync + statement import jobs (needs REDIS_URL)
npm run dev:ui
```

### Demo data (mock seed)

Load deterministic fixtures from [`mock/`](mock/) into Postgres (see [`mock/README.md`](mock/README.md)):

```bash
npm run db:migrate   # if needed
npm run db:seed
# npm run db:seed -- --no-reset   # upsert without deleting seed users first
```

Regenerate JSON fixtures from the generator:

```bash
npm run db:gen-mock
```

Use with `AUTH_ALLOW_DEV_USER=true` and `NEXT_PUBLIC_USE_MOCKS=false` in root `.env` to exercise the real API and UI (dev user: `personal@spendflow.local`).

### Database migrations

```bash
npm run db:generate    # drizzle-kit: new SQL from schema changes
npm run db:migrate     # apply backend/drizzle/*.sql (custom runner)
```

`db:generate` uses Drizzle Kit; `db:migrate` uses the project migrator in `backend/src/db/migrate.ts` (not `drizzle-kit migrate`).

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

### 📉 Inflation Intelligence

> **Goal:** Show users how inflation is silently eroding their purchasing power using their *own* spending data — not a government average that may not reflect their life at all. The CPI is a national basket; your personal inflation rate is what actually matters.

The core insight: a 3% salary raise during 4.5% personal inflation is a 1.5% pay cut that never shows up on your paycheck. SpendFlow can make this visible automatically.

| Feature | Description |
|---------|-------------|
| **Personal inflation rate** | Calculate your household's real inflation rate by weighting BLS CPI sub-index rates (food, housing, healthcare, transport, etc.) by your *actual* spending distribution — not the national average. Updated monthly as your spending shifts |
| **Purchasing power timeline** | Chart showing how much your income could buy at each point in time — "Your $80K salary buys what $71K bought in 2020" — with category-level breakdown of where the erosion is worst |
| **Category inflation heatmap** | Color-coded grid of your spending categories ranked by how fast they're inflating — healthcare at 4.1%, groceries at 3.8%, shelter at 3.0% — cross-referenced with what share of your budget each consumes |
| **Real wage tracker** | Enter your salary history; SpendFlow computes your *real* wage after personal inflation. Flag years when you effectively took a pay cut despite a nominal raise. Show cumulative purchasing power loss since hire date |
| **Salary negotiation brief** | Auto-generate a data-backed brief for your next raise conversation: "Your personal inflation rate this year was 4.3%. A 3% raise is a 1.2% real pay cut. You need X to break even, Y to actually advance." |
| **Inflation break-even alert** | Notify when your income growth is falling behind your personal inflation rate — month by month, not just annually |
| **Inflation-adjusted spending comparison** | When comparing this year's spending to last year, show both nominal and inflation-adjusted numbers so you know if you genuinely changed behavior or just paid more for the same things |
| **Category price spike detector** | Track recurring merchant prices over time (groceries, gas, utilities) to detect when a specific store or service has raised prices above the category average |
| **Tariff & policy impact estimator** | When major policy changes (tariffs, healthcare rules) hit, estimate the projected impact on your specific spending basket |
| **Safe real savings rate** | Show savings rate in *real* terms — a 5% savings rate with 4% inflation is only growing your wealth by ~1% in purchasing power; make this explicit |

**Data sources:** BLS CPI sub-indices (API), FRED economic data, BEA PCE deflators

---

### 🧠 Lifestyle & Behavioral Finance

> **Goal:** Help users understand the *psychology* behind their spending — identify lifestyle creep, surface emotional spending patterns, build lasting financial habits through behavioral science, and give them a single score that tells them if they're on the right track.

Research shows that tracking data alone doesn't change behavior. What changes behavior is surfacing the right insight, at the right moment, in the right framing. SpendFlow can be the app that actually rewires financial habits — not just records them.

| Feature | Description |
|---------|-------------|
| **Financial Wellness Score (0–100)** | A single composite score updated monthly across 7 dimensions: savings rate, debt health, emergency fund runway, income-to-expense ratio, personal inflation beat, investment growth, and goal pace. Color-coded: green / yellow / red. No interpretation required |
| **Lifestyle creep detector** | Track your spending-to-income ratio over time. When income rises and spending rises proportionally, flag it: "Since your last raise in March, your discretionary spending grew 22% — your savings rate hasn't improved" |
| **Spending personality profile** | Monthly archetype based on your category mix: "Foodie," "Homebody," "Commuter," "Experience Seeker." Show how your type has evolved over 12 months and what it costs annually vs. national median for that archetype |
| **Emotional spending patterns** | Detect temporal spending clusters: late-night purchases, weekend spikes, post-payday splurges, stress-period spikes in food delivery / retail. Surface these patterns non-judgmentally: "You spend 43% more on weekends than weekdays" |
| **Habit streaks & milestones** | Gamified savings streaks (7-day, 30-day under-budget runs), category improvement badges, net worth milestones. Research shows streaks reduce financial slip-ups by up to 40% |
| **Safe-to-spend calculator** | After accounting for bills, scheduled transfers, and savings goals, show a daily/weekly discretionary budget — "You have $47 left to spend freely this week without touching your goals" |
| **Peer benchmarking** | Anonymized, opt-in comparison of your category spending vs. similar income bracket / city / household size. "You spend 2.1x the median on dining for your income bracket in your city" |
| **Financial momentum score** | Week-over-week velocity metric: are you trending toward better or worse financial health? A simple up/down arrow with a plain-English reason — "Your savings rate improved 3pts this month but food spending is creeping up" |
| **30-day spending challenge** | Structured challenges: "Cut dining by 20% this month," "No impulse purchases over $50 without 24h wait," "Automate $200 extra to savings." Track in-app with daily progress |
| **Counterfactual cost calculator** | Show the true annual and 10-year cost of habits: "Your $6/day coffee habit costs $2,190/year and $27,000 over 10 years if invested at 7% return" — but frame it as information, not guilt |
| **Life stage financial compass** | Adapt insights to life stage (early career, family building, peak earning, pre-retirement). Goals, benchmarks, and alerts shift automatically based on age, household size, and income level |
| **Annual financial review** | Auto-generated year-in-review: biggest spending changes, goals hit and missed, net worth delta, biggest wins, and 3 concrete priorities for next year |
| **Financial decision journal** | Log major financial decisions (car purchase, lease renewal, salary negotiation) and tag relevant transactions. Review 6 months later to see if the decision played out as expected — builds decision quality over time |

**Research basis:** Behavioral finance principles from Kahneman, Thaler & Sunstein (nudge theory), Laibson (present bias), BLS ECI data for wage tracking

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
- 🔄 Phase 3: Spend page, smart alerts, CSV export, mobile responsive polish, **unified navigation IA + Accounts/Debt merge**
- 🧪 Phase 3.5: Roadmap features prototyped as interactive **preview** hubs (Plan, Wealth, Insights, Protect, Coach, Wrapped) — Net Worth & Investments wired to real balances, rest on illustrative data pending backend endpoints
- 🔄 Phase 3.6: **Statement import** — UI upload + encrypted storage shipped; CSV parsers (E*TRADE/Fidelity/Webull) + worker next — see [TASK_BOARD.md](docs/development/TASK_BOARD.md)
- ⏸️ Phase 4: iPhone app (SwiftUI) — **deferred / lowest priority**
- ⏳ Phase 5: Productionize AI coach, budgets, net worth, investment analysis (back the previews with real APIs)

---

## Contributing

See [AGENTS.md](AGENTS.md) for AI agent guidelines and coding standards. Per-language rules live in `.cursor/rules/`.

- No `.env` files or secrets in commits
- Strict TypeScript — no `any`
- Validate all external input with Zod
- One concern per PR when possible
