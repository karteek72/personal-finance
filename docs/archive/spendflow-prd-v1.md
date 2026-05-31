# SpendFlow — Product Requirements Document & Technical Specification

**Version:** 1.0  
**Status:** Ready for Development  
**Last Updated:** May 2026  
**Product Type:** Personal Finance Dashboard — Web Application (SaaS)

---

## Executive Summary

SpendFlow is a personal finance intelligence platform that automatically aggregates transactions from all credit cards, checking accounts, and savings accounts via live bank API integrations. It eliminates manual CSV exports by connecting directly to 12,000+ financial institutions through open banking aggregators (Plaid, Finicity, MX). The platform reconciles money flow between bank accounts and credit cards, categorizes every transaction using ML, and surfaces actionable spending insights — so users know exactly where their money goes and where they are wasting it.

---

## 1. Problem Statement

### Core Pain Points

- Manual CSV download from each bank/card portal is tedious, error-prone, and only done retrospectively
- Credit card payments from a checking account appear as "expenses" in naive tools, double-counting spend
- No single source of truth for multi-card, multi-bank households
- Existing tools (Mint, YNAB) have poor reconciliation and weak insight quality
- Users cannot see their true net cash flow after inter-account transfers are stripped out

### Target Users

| Persona | Description | Key Need |
|---------|-------------|----------|
| **Active Multi-Card User** | 2–5 credit cards, 1–2 bank accounts, earns $80K–$200K | Spend visibility, category breakdown |
| **Savings-Focused User** | Tracks monthly savings rate, invests surplus | Net flow, savings rate alerts |
| **Budget Optimizer** | Wants to cut subscriptions and dining | Anomaly alerts, trend comparison |

---

## 2. Product Goals & Success Metrics

### Goals

1. **Zero-friction data ingestion** — connect all accounts in under 3 minutes via OAuth, no CSV exports
2. **True money flow** — reconcile CC payments, savings transfers so net spending is accurate
3. **Actionable insights** — highlight overspending categories with month-over-month deltas
4. **Real-time** — transaction data refreshed daily (or on-demand) via webhooks

### Success Metrics (KPIs)

| Metric | Target |
|--------|--------|
| Account connection success rate | ≥ 95% |
| Time-to-first-insight after signup | < 5 minutes |
| Daily active users / Monthly active users | ≥ 40% |
| Avg accounts connected per user | ≥ 4 |
| Transaction auto-categorization accuracy | ≥ 88% |

---

## 3. Feature Scope — MVP vs V2

### MVP (Launch)

- [ ] Plaid integration for US banks & credit cards (12,000+ institutions)
- [ ] OAuth-based account linking (no credential sharing)
- [ ] Transaction sync via webhooks (daily refresh)
- [ ] Auto-categorization (ML-based, 15 categories)
- [ ] Inter-account transfer reconciliation (CC payments, savings moves)
- [ ] Dashboard: KPI cards, trend charts, donut category breakdown
- [ ] Money Flow view (Income → Bank → CC visual)
- [ ] Spending alerts (high category spend, subscription creep, low savings rate)
- [ ] Transaction search, filter, manual re-categorization
- [ ] CSV export
- [ ] Dark/light mode
- [ ] Mobile-responsive (375px+)

### V2 (Post-Launch)

- [ ] MX Technologies & Finicity as fallback aggregators (broader coverage)
- [ ] Investment account aggregation (Fidelity, Schwab, Robinhood)
- [ ] Budget setting per category with alert thresholds
- [ ] AI spending coach (LLM-powered Q&A over your data)
- [ ] Recurring subscription detector
- [ ] Net worth tracker (assets − liabilities)
- [ ] Tax export (Schedule C, 1099 category tagging)
- [ ] Multi-user household mode

---

## 4. Open Banking API Architecture

### Primary Aggregator: Plaid

Plaid is the industry-standard data aggregator connecting to 12,000+ US financial institutions. It uses OAuth-based direct connections (not screen scraping) for major banks, eliminating the need for users to share credentials.

**Key Plaid Products Used:**

| Plaid Product | Purpose | Endpoint |
|--------------|---------|----------|
| **Link** | User-facing OAuth connection UI | Frontend SDK |
| **Transactions** | Fetch categorized transaction history | `/transactions/get` |
| **Auth** | Account & routing number verification | `/auth/get` |
| **Balance** | Real-time balance check | `/accounts/balance/get` |
| **Liabilities** | Credit card statement details, APR | `/liabilities/get` |
| **Webhooks** | Push notification on new transactions | `TRANSACTIONS_INITIAL_UPDATE` |
| **Identity** | Account holder name verification | `/identity/get` |

**Coverage:** Plaid covers 95%+ of US banks that provide checking/savings, and nearly all major credit cards (Chase, Amex, Citi, BofA, Capital One, Discover, Wells Fargo, US Bank).

**Connection Flow:**
```
User clicks "Connect Account"
  → Frontend opens Plaid Link (iframe modal)
    → User selects institution
      → Bank OAuth redirect (no credentials to SpendFlow)
        → Plaid returns public_token
          → Backend exchanges for access_token (server-side)
            → access_token stored encrypted in DB
              → Initial transaction fetch triggered
                → Webhooks registered for ongoing sync
```

### Fallback Aggregators (V2)

| Provider | Strength | Coverage |
|----------|----------|----------|
| **Finicity** (Mastercard) | Strong credit bureau relationships, lending data | US, Canada |
| **MX Technologies** | Deep analytics, data quality layer | US, Canada |
| **Yodlee** (Envestnet) | Global coverage, oldest platform | US + International |

For MVP, Plaid alone covers the vast majority of users. Finicity and MX add redundancy for institutions Plaid cannot reach via OAuth (community banks, credit unions).

### Webhook Strategy

Rather than polling on a schedule, Plaid pushes webhooks when new transaction data is available. This ensures near-real-time data without unnecessary API calls:

```
Plaid → POST /api/webhooks/plaid
  → Verify webhook signature (HMAC-SHA256)
    → Queue background job (BullMQ)
      → Fetch new transactions
        → Run categorization pipeline
          → Update DB
            → Push WS notification to connected client
```

Webhook events to handle:
- `TRANSACTIONS_INITIAL_UPDATE` — first load after account link
- `TRANSACTIONS_DEFAULT_UPDATE` — daily transaction push
- `TRANSACTIONS_REMOVED` — pending transactions that cleared differently
- `ITEM_ERROR` — connection broken, needs re-auth

---

## 5. Reconciliation Engine

This is the core IP of SpendFlow — correctly identifying inter-account transfers to avoid double-counting.

### Transfer Detection Rules

```
A transaction is classified as TRANSFER if:
  1. From a checking/savings account AND
  2. Description matches pattern:
     - "ONLINE PAYMENT THANK YOU" (credit card payment received)
     - "AUTOPAY" + card name
     - "TRANSFER TO [account name]"
     - "ZELLE TRANSFER" to own account
     - Amount matches a balance within ±$5 tolerance
  OR
  3. A matching incoming transaction exists on another account
     within ±3 days AND ±$5 of the same amount
```

### Money Flow Model

```
True Net Cash Flow = Gross Income
                   − Direct Expenses (non-CC accounts)
                   − Credit Card Charges (CC accounts only)
                   [CC Payments from Bank → CC are EXCLUDED]
                   [Savings Transfers are EXCLUDED from spending]
```

### Reconciliation Categories

| Transaction Type | Classification | Included in Spend? |
|-----------------|---------------|-------------------|
| Salary deposit | Income | No |
| Interest earned | Income | No |
| Credit card charge | Expense | Yes |
| Credit card payment from bank | Transfer | **No** |
| Savings transfer out | Transfer | **No** |
| Savings transfer in | Transfer | **No** |
| ATM withdrawal | Expense | Yes (if spent) |
| Bank fee | Expense | Yes |

---

## 6. Auto-Categorization Pipeline

### Category Taxonomy (15 categories)

1. Food & Groceries
2. Dining & Restaurants
3. Transport & Gas
4. Entertainment
5. Shopping & Retail
6. Utilities & Bills
7. Health & Medical
8. Travel & Hotels
9. Subscriptions & Software
10. Home & Rent
11. Education
12. Personal Care
13. Financial (insurance, investments, fees)
14. Income
15. Transfers (internal)

### Categorization Approach (Layered)

**Layer 1 — Plaid Native Categories**  
Plaid returns its own category labels with each transaction. These are used as the base signal.

**Layer 2 — Merchant Name Rule Engine**  
A curated rule table maps known merchant names to categories with high precision:
```json
{
  "HEB": "Food & Groceries",
  "Whole Foods": "Food & Groceries",
  "Netflix": "Subscriptions",
  "Shell": "Transport & Gas",
  "Southwest Airlines": "Travel",
  "ChatGPT": "Subscriptions"
}
```

**Layer 3 — ML Classifier (V2)**  
Fine-tuned text classifier (DistilBERT or logistic regression on TF-IDF) trained on Plaid's categorized corpus. Input: transaction description + amount + merchant MCC code. Output: category + confidence score.

**Layer 4 — User Override**  
Any user-corrected category is saved and takes permanent precedence. Corrections are fed back into the personal model for improved future accuracy.

---

## 7. UI/UX Design Specification

### Design Principles

- **Data-first, decoration-last** — every visual element must carry information
- **Compact density** — dashboard users want to see everything without scrolling; use generous whitespace only for hierarchy
- **Teal/neutral palette** — Nexus Design System (teal primary, warm dark surfaces)
- **Tabular numerals** — all money values in JetBrains Mono for visual alignment
- **Mobile-first** — sidebar collapses to bottom nav on mobile

### Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| Body, labels | Inter | 14–16px | 400, 500 |
| Numbers, amounts | JetBrains Mono | 12–22px | 400, 500 |
| Section headings | Inter | 18–24px | 600 |
| Page title | Inter | 22–28px | 700 |

### Color Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-primary` | `#01696f` | `#4f98a3` | Teal — CTAs, active states, savings |
| `--color-danger` | `#c0392b` | `#e05c4a` | Red — expenses, overspend alerts |
| `--color-success` | `#437a22` | `#6daa45` | Green — income, positive delta |
| `--color-warning` | `#b07a00` | `#e8af34` | Amber — warnings, budget nearing limit |
| `--color-bg` | `#f7f6f2` | `#0f0e0d` | Page background |
| `--color-surface` | `#f9f8f5` | `#161513` | Cards, panels |
| `--color-border` | `#d4d1ca` | `#2e2d2b` | Dividers |

### Page Layouts

#### Dashboard Page

```
┌─ Sidebar ─────────┬─ Top Bar (sticky) ──────────────────────────────┐
│  Logo             │  "Dashboard"          [Year] [Theme] [Import]   │
│  Nav Items        ├──────────────────────────────────────────────────┤
│  ─────────        │  Month Filter Pills (Jan…Dec | All Year)         │
│  Accounts List    │  ─────────────────────────────────────────────── │
│                   │  KPI Grid (6 cards):                             │
│                   │  [Total Spent] [Income] [Net Savings]            │
│                   │  [Avg Monthly] [Top Category] [CC Payments]      │
│                   │  ─────────────────────────────────────────────── │
│                   │  [Monthly Trend Chart — Full Width]              │
│                   │  ─────────────────────────────────────────────── │
│                   │  [Category Donut]       [Account Bar Chart]      │
│                   │  ─────────────────────────────────────────────── │
│                   │  Smart Alerts (contextual, dismissible)          │
└───────────────────┴──────────────────────────────────────────────────┘
```

#### Money Flow Page

```
┌──────────────────────────────────────────────────────────┐
│  Reconciliation Banner (green, always visible)           │
├──────────────────┬──────────────┬───────────────────────┤
│  Income Sources  │  Bank Accts  │  Credit Cards         │
│  Salary          │  Chase Chk   │  Chase Sapphire       │
│  Interest        │  Ally Sav    │  Amex Gold            │
│  ─────────       │  ─────────   │  Citi DC              │
│  Total: $XX,XXX  │  Flows shown │  Total CC: $XX,XXX    │
├──────────────────┴──────────────┴───────────────────────┤
│  Monthly Income vs Expenses vs Net (combo chart)         │
└──────────────────────────────────────────────────────────┘
```

#### Categories Page

```
┌──────────────────────────────────────────────────────────┐
│  Proportional spend bar (segmented, color-coded)         │
│  Category list: [dot] Name ——bar—— XX%   $X,XXX          │
├──────────────────────────────────────────────────────────┤
│  Category Monthly Trends (multi-line chart)              │
└──────────────────────────────────────────────────────────┘
```

#### Account Connect Page (Plaid Link)

```
┌──────────────────────────────────────────────────────────┐
│  Connected Accounts Grid                                 │
│  [Chase Sapphire ✓] [Amex Gold ✓] [+ Add Account]       │
├──────────────────────────────────────────────────────────┤
│  Each card shows: institution logo, account type,        │
│  last synced time, balance, connection status            │
│  [Reconnect] button if OAuth expired                     │
└──────────────────────────────────────────────────────────┘
```

### Component Library

| Component | Behavior |
|-----------|----------|
| `KPICard` | Value + delta vs prior period + sparkline (7-day) |
| `TrendChart` | Bar/line toggle, Chart.js, tabular number tooltips |
| `DonutChart` | 60% cutout, legend right, hover shows amount + % |
| `CategoryRow` | Animated bar fill on mount, click drills to transactions |
| `TransactionRow` | Category dot, merchant name, mono amount, type badge |
| `PlaidLinkButton` | Opens Plaid Link iframe, handles success/error callbacks |
| `AlertBanner` | Dismissible, color by severity, contextual CTA |
| `SkeletonLoader` | Shimmer animation, matches real layout shape |

### Responsive Breakpoints

| Breakpoint | Layout Change |
|------------|--------------|
| < 768px | Sidebar → bottom tab bar (4 tabs); KPIs → 2-col; charts full-width |
| 768–1024px | Sidebar visible; charts 1-col |
| > 1024px | Full 2-col chart grid; KPI 3-col |

---

## 8. Technical Architecture

### Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 15 (App Router) + TypeScript | SSR for first-load perf, RSC for server data |
| **Styling** | Tailwind CSS v4 + CSS custom properties | Token-based, dark mode, responsive |
| **Charts** | Chart.js 4 + Recharts (hybrid) | Chart.js for animated bar/line; Recharts for composable combos |
| **State** | Zustand + React Query (TanStack) | Local UI state + server cache + optimistic updates |
| **Backend** | Node.js + Fastify (or Next.js API routes) | Low overhead, TypeScript native |
| **Database** | PostgreSQL (Supabase) | ACID compliance, row-level security for multi-user |
| **ORM** | Drizzle ORM | Type-safe, PostgreSQL-native, no runtime overhead |
| **Queue** | BullMQ + Redis | Webhook processing, transaction sync jobs |
| **Auth** | Clerk or NextAuth.js v5 | OAuth2 (Google, Apple), session management |
| **Encryption** | AES-256-GCM | Plaid access tokens encrypted at rest |
| **Hosting** | Vercel (frontend) + Railway/Fly.io (API/workers) | CI/CD from GitHub |
| **Monitoring** | Sentry (errors) + Axiom (logs) + Upstash (Redis) | Observability stack |

### Database Schema (Core Tables)

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Plaid Items (one per institution connection)
plaid_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  plaid_item_id TEXT UNIQUE NOT NULL,         -- Plaid's item ID
  access_token TEXT NOT NULL,                  -- AES-256 encrypted
  institution_id TEXT,
  institution_name TEXT,
  status TEXT DEFAULT 'active',               -- active | error | reauth_required
  last_synced_at TIMESTAMPTZ,
  cursor TEXT,                                 -- Plaid sync cursor
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Accounts
accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  plaid_item_id UUID REFERENCES plaid_items(id),
  plaid_account_id TEXT UNIQUE NOT NULL,
  name TEXT,
  official_name TEXT,
  type TEXT,                                  -- depository | credit | investment
  subtype TEXT,                               -- checking | savings | credit card
  mask TEXT,                                  -- last 4 digits
  balance_current NUMERIC(12,2),
  balance_available NUMERIC(12,2),
  currency_code TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT TRUE
)

-- Transactions
transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  account_id UUID REFERENCES accounts(id),
  plaid_transaction_id TEXT UNIQUE,
  date DATE NOT NULL,
  name TEXT,                                  -- merchant name
  merchant_name TEXT,
  amount NUMERIC(12,2) NOT NULL,              -- positive = money out, negative = money in
  currency_code TEXT DEFAULT 'USD',
  category TEXT,                              -- our category
  plaid_category TEXT[],                      -- Plaid's category array
  transaction_type TEXT,                      -- expense | income | transfer
  is_transfer BOOLEAN DEFAULT FALSE,
  transfer_pair_id UUID,                      -- links matched transfer pair
  pending BOOLEAN DEFAULT FALSE,
  user_category_override TEXT,               -- user's manual override
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Indexes
CREATE INDEX idx_tx_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_tx_category ON transactions(user_id, category);
CREATE INDEX idx_tx_account ON transactions(account_id);
```

### API Endpoints

#### Auth & Users
```
POST   /api/auth/register
POST   /api/auth/login
DELETE /api/auth/logout
GET    /api/auth/me
```

#### Plaid Integration
```
POST   /api/plaid/create-link-token        → Returns link_token for Plaid Link
POST   /api/plaid/exchange-token           → { public_token } → stores access_token
GET    /api/plaid/accounts                 → List all connected accounts
DELETE /api/plaid/items/:itemId            → Disconnect an institution
POST   /api/plaid/sync/:itemId             → Manual sync trigger
POST   /api/webhooks/plaid                 → Plaid webhook receiver (HMAC verified)
```

#### Transactions
```
GET    /api/transactions                   → Paginated, filterable list
       ?month=2025-05&category=Dining&account=<id>&q=starbucks&limit=50&cursor=<cursor>
GET    /api/transactions/summary           → KPI aggregates for given date range
GET    /api/transactions/by-category       → Category totals with month breakdown
GET    /api/transactions/flow              → Money flow reconciliation data
PATCH  /api/transactions/:id/category     → User re-categorize
GET    /api/transactions/export.csv        → CSV export stream
```

#### Insights
```
GET    /api/insights/alerts                → Smart alerts (savings rate, overspend)
GET    /api/insights/trends                → Month-over-month delta per category
GET    /api/insights/subscriptions         → Detected recurring charges
```

### Plaid Integration — Code Outline

```typescript
// lib/plaid.ts — server-side only
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV], // sandbox | development | production
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
export const plaidClient = new PlaidApi(config);

// POST /api/plaid/create-link-token
export async function createLinkToken(userId: string) {
  const res = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'SpendFlow',
    products: ['transactions'],
    optional_products: ['liabilities', 'investments'],
    country_codes: ['US'],
    language: 'en',
    webhook: `${process.env.APP_URL}/api/webhooks/plaid`,
  });
  return res.data.link_token;
}

// POST /api/plaid/exchange-token
export async function exchangeToken(publicToken: string) {
  const res = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
  return {
    accessToken: encrypt(res.data.access_token), // AES-256-GCM
    itemId: res.data.item_id,
  };
}

// Incremental sync using cursor (most efficient)
export async function syncTransactions(accessToken: string, cursor?: string) {
  let nextCursor = cursor;
  const added = [], modified = [], removed = [];
  let hasMore = true;
  while (hasMore) {
    const res = await plaidClient.transactionsSync({
      access_token: decrypt(accessToken),
      cursor: nextCursor,
      options: { include_personal_finance_category: true },
    });
    added.push(...res.data.added);
    modified.push(...res.data.modified);
    removed.push(...res.data.removed);
    nextCursor = res.data.next_cursor;
    hasMore = res.data.has_more;
  }
  return { added, modified, removed, nextCursor };
}
```

### Webhook Handler

```typescript
// POST /api/webhooks/plaid
export async function plaidWebhook(req, res) {
  // 1. Verify Plaid signature
  const isValid = await verifyPlaidWebhook(req.headers, req.body);
  if (!isValid) return res.status(401).send('Invalid signature');

  const { webhook_type, webhook_code, item_id } = req.body;

  if (webhook_type === 'TRANSACTIONS') {
    if (['INITIAL_UPDATE', 'DEFAULT_UPDATE', 'HISTORICAL_UPDATE'].includes(webhook_code)) {
      await queue.add('sync-transactions', { itemId: item_id });
    }
    if (webhook_code === 'TRANSACTIONS_REMOVED') {
      await queue.add('remove-transactions', { removedIds: req.body.removed_transactions });
    }
  }

  if (webhook_type === 'ITEM' && webhook_code === 'ERROR') {
    await markItemAsError(item_id, req.body.error);
    await notifyUserToReconnect(item_id);
  }

  res.status(200).send('OK');
}
```

### Reconciliation Engine

```typescript
// services/reconciliation.ts

const TRANSFER_PATTERNS = [
  /online payment thank you/i,
  /autopay/i,
  /payment received/i,
  /transfer to/i,
  /transfer from/i,
  /zelle (to|from)/i,
  /chase credit card/i,
  /amex autopay/i,
  /citi payment/i,
];

export function classifyTransaction(tx: Transaction, allAccountTypes: Map<string, string>): 'expense' | 'income' | 'transfer' {
  const accountType = allAccountTypes.get(tx.account_id);

  // Positive amount on depository = income
  if (accountType === 'depository' && tx.amount < 0) {
    if (TRANSFER_PATTERNS.some(p => p.test(tx.name))) return 'transfer';
    return 'income';
  }

  // Credit account expenses (positive = money owed)
  if (accountType === 'credit' && tx.amount > 0) return 'expense';

  // Depository debits
  if (accountType === 'depository' && tx.amount > 0) {
    if (TRANSFER_PATTERNS.some(p => p.test(tx.name))) return 'transfer';
    return 'expense';
  }

  return 'expense';
}

// Match transfer pairs across accounts (avoid double-counting)
export async function matchTransferPairs(userId: string, newTxs: Transaction[]) {
  const transfers = newTxs.filter(t => t.transaction_type === 'transfer');
  for (const tx of transfers) {
    const match = await db.query(`
      SELECT id FROM transactions
      WHERE user_id = $1
        AND ABS(amount) BETWEEN $2 - 5 AND $2 + 5
        AND date BETWEEN $3 - INTERVAL '3 days' AND $3 + INTERVAL '3 days'
        AND transaction_type = 'transfer'
        AND transfer_pair_id IS NULL
        AND id != $4
      LIMIT 1
    `, [userId, Math.abs(tx.amount), tx.date, tx.id]);
    if (match.rows[0]) {
      await db.query(`UPDATE transactions SET transfer_pair_id = $1 WHERE id = $2`, [tx.id, match.rows[0].id]);
      await db.query(`UPDATE transactions SET transfer_pair_id = $1 WHERE id = $2`, [match.rows[0].id, tx.id]);
    }
  }
}
```

---

## 9. Security & Compliance

### Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| No credential storage | Plaid OAuth — credentials go only to bank, never to SpendFlow |
| Token encryption at rest | AES-256-GCM with per-user key derivation (AWS KMS or Vault) |
| Token encryption in transit | TLS 1.3 minimum on all API routes |
| Webhook verification | Plaid HMAC-SHA256 signature on every webhook |
| Row-level security | PostgreSQL RLS — users can only query their own rows |
| Session management | Signed JWTs (RS256), 24-hour expiry, refresh token rotation |
| Rate limiting | 100 req/min per user via Redis sliding window |
| Secret management | Environment variables via Vercel/Railway secrets, never in code |
| Audit logging | All `access_token` reads logged with timestamp and requester |

### Regulatory Considerations

- **CCPA** — California users have right to data deletion; implement `DELETE /api/users/me` that cascades all data and revokes Plaid items
- **Plaid ToS** — Data usage restricted to user-permissioned personal finance; cannot sell or share transaction data
- **SOC 2 Type II** — Plaid is SOC 2 certified; SpendFlow should pursue SOC 2 for enterprise users (V2)

---

## 10. Plaid Environment & Pricing

### Environments

| Environment | Purpose | Cost |
|------------|---------|------|
| `sandbox` | Development & testing — uses synthetic data | Free |
| `development` | Real accounts, up to 100 items | Free |
| `production` | Live users, unlimited items | Pay-per-use |

### Plaid Production Pricing (2025)

Plaid uses a per-item-per-month pricing model:

- **Transactions product:** ~$0.30–$0.60/connected account/month (negotiated enterprise rate)
- **Auth product:** ~$0.30/verification
- Free tier: available via the Plaid developer dashboard for low-volume personal projects

For a personal-use app (< 5 accounts), costs are effectively $0 under the developer tier. For a multi-user product, budget ~$0.50/account/month.

---

## 11. Development Phases & Timeline

### Phase 1 — Foundation (Weeks 1–4)
- [ ] Project scaffold: Next.js 15, TypeScript, Tailwind v4, PostgreSQL/Supabase
- [ ] Auth system (Clerk or NextAuth)
- [ ] Plaid Sandbox integration: Link → exchange token → fetch accounts
- [ ] Database schema + Drizzle ORM migrations
- [ ] Basic transaction sync job (polling, no webhooks yet)

### Phase 2 — Core Product (Weeks 5–8)
- [ ] Webhook receiver + BullMQ queue
- [ ] Incremental sync with Plaid cursor
- [ ] Reconciliation engine (transfer detection + pair matching)
- [ ] Auto-categorization (rule engine + Plaid categories)
- [ ] Dashboard UI: KPI cards, trend chart, donut chart
- [ ] Money Flow page

### Phase 3 — Polish & Launch (Weeks 9–12)
- [ ] Categories page + transaction table
- [ ] Smart alerts engine
- [ ] CSV export
- [ ] Mobile responsive (375px)
- [ ] Error handling: item reconnect flow, webhook error states
- [ ] Production Plaid approval + environment switch
- [ ] Sentry, Axiom, uptime monitoring setup

### Phase 4 — V2 Features (Weeks 13+)
- [ ] MX / Finicity fallback aggregators
- [ ] AI spending coach (OpenAI or local Ollama for privacy)
- [ ] Budget setting + alerts
- [ ] Net worth tracker
- [ ] Subscription detector

---

## 12. Environment Variables

```env
# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox              # sandbox | development | production

# Database
DATABASE_URL=                  # PostgreSQL connection string

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Encryption
ENCRYPTION_KEY=                # 32-byte AES key (hex)

# Queue
REDIS_URL=                     # Upstash or Railway Redis

# App
APP_URL=https://spendflow.app
NEXT_PUBLIC_APP_URL=https://spendflow.app

# Monitoring
SENTRY_DSN=
AXIOM_TOKEN=
```

---

## 13. Folder Structure

```
spendflow/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Sidebar layout
│   │   ├── page.tsx              # Dashboard
│   │   ├── flow/page.tsx         # Money Flow
│   │   ├── categories/page.tsx
│   │   ├── transactions/page.tsx
│   │   └── accounts/page.tsx     # Plaid Link + account management
│   └── api/
│       ├── plaid/
│       │   ├── create-link-token/route.ts
│       │   ├── exchange-token/route.ts
│       │   ├── accounts/route.ts
│       │   └── sync/[itemId]/route.ts
│       ├── webhooks/
│       │   └── plaid/route.ts
│       ├── transactions/route.ts
│       └── insights/route.ts
├── components/
│   ├── ui/                       # Design system primitives
│   │   ├── KPICard.tsx
│   │   ├── TrendChart.tsx
│   │   ├── DonutChart.tsx
│   │   ├── CategoryRow.tsx
│   │   ├── TransactionRow.tsx
│   │   ├── AlertBanner.tsx
│   │   └── SkeletonLoader.tsx
│   ├── plaid/
│   │   ├── PlaidLink.tsx         # Plaid Link button + handler
│   │   └── AccountCard.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       └── TopBar.tsx
├── lib/
│   ├── plaid.ts                  # Plaid client + API helpers
│   ├── db.ts                     # Drizzle DB client
│   ├── encrypt.ts                # AES-256-GCM helpers
│   ├── reconciliation.ts         # Transfer detection engine
│   ├── categorize.ts             # Categorization pipeline
│   └── queue.ts                  # BullMQ client
├── workers/
│   └── sync.worker.ts            # Background transaction sync
├── schema/
│   └── schema.ts                 # Drizzle schema definitions
├── styles/
│   └── globals.css               # Design tokens + base CSS
└── types/
    └── index.ts
```

---

## 14. Third-Party Services Summary

| Service | Purpose | Tier | Est. Monthly Cost |
|---------|---------|------|------------------|
| **Plaid** | Bank data aggregation | Developer (free to 100 items) | $0–$50 |
| **Supabase** | PostgreSQL + auth fallback | Free / Pro ($25) | $0–$25 |
| **Vercel** | Frontend hosting + edge | Hobby (free) / Pro ($20) | $0–$20 |
| **Railway** | API server + Redis + worker | Starter ($5) | $5–$20 |
| **Upstash** | Redis for BullMQ | Free (10K req/day) | $0–$10 |
| **Clerk** | Authentication | Free (10K MAU) | $0 |
| **Sentry** | Error tracking | Free (5K errors/mo) | $0 |
| **Total MVP** | | | **~$5–$75/month** |

---

## 15. Open Questions for Development Team

1. **Multi-user vs personal:** Is this a single-user personal app or multi-tenant SaaS? Affects auth architecture, RLS policies, and Plaid plan.
2. **Plaid vs free alternatives:** For purely personal use, some developers use **Plaid Sandbox + self-hosted** with manual export as fallback. Confirm whether a Plaid production account is acceptable.
3. **AI categorization:** Prefer cloud LLM (OpenAI) or local (Ollama — aligns with existing Ollama setup) for the V2 AI coach feature?
4. **Hosting preference:** Vercel + Railway vs self-hosted on existing Linux infrastructure?
5. **Mobile app:** React Native/Expo (code-share from Next.js) vs web-only (PWA)?

