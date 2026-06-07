# UI/UX Specification

**Product:** SpendFlow  
**Last Updated:** June 2026

Visual tokens and components: [design-system.md](design-system.md)  
Interactive reference: [SpendFlow UI Mockup canvas](/home/karteek/.cursor/projects/opt-personal-finance/canvases/spendflow-ui-mockup.canvas.tsx)

---

## Design principles

- **Data-first, decoration-last** — every visual element carries information
- **Compact density** — show the dashboard without excessive scrolling; whitespace for hierarchy only
- **Mobile-first** — sidebar collapses to bottom nav on small screens
- **No duplicate information** — every metric has one canonical home; consolidate rather than repeat across pages
- **Icon-first actions** — toolbar/inline actions render as icon buttons with hover/`title` tooltips so layouts fit phone → laptop; keep words for data, headings, and primary empty-state CTAs
- **Wire real data where cheap; flag the rest** — pages built on roadmap concepts are interactive "preview" mockups; sections still on illustrative data carry an amber preview banner

---

## Information architecture

The sidebar is one sectioned list (Overview · Money · Insights · Family) — there is no separate "Preview" group. Hubs combine related features behind tabs; redirects keep legacy links alive. **(preview)** = interactive mockup on illustrative data; **(live)** uses real account/transaction data.

| Section | Route | Page | Composition / primary actions |
|---------|-------|------|-------------------------------|
| Overview | `/` | Home | KPIs, net-savings hero, account-balance rollup, alerts, seasonal Wrapped banner |
| Overview | `/transactions` | Activity | Search, filter, re-categorize |
| Overview | `/categories` | Spend | Tabs: Overview (live) · Merchants (preview) · Patterns (preview) |
| Money | `/plan` | Plan | Tabs: Budgets & Goals · Money Calendar · Forecast · Recurring (subscriptions + leaks) — preview |
| Money | `/wealth` | Wealth | Tabs: Net Worth (live) · Investments (live balances) · FIRE (preview) · Time Machine (preview) |
| Money | `/accounts` | Accounts & Debt | Connect/reconnect Plaid; balances grouped by type; per-tile credit/liability detail |
| Insights | `/understand` | Insights | Tabs: Wellness · Spending DNA · Behavioral — preview |
| Insights | `/protect` | Protect | Tabs: Resilience · Inflation Intel — preview |
| Family | `/family` | Family | Household members, shared spend |
| — | `/flow` | → `/categories` | redirect (retired Money Flow route) |
| — | `/debt` | → `/accounts` | redirect (Debt merged into Accounts) |
| Auth | `/login`, `/register` | Login / Register | Auth |

**Global, non-route UI:** **Coach** — a floating AI-assistant FAB available on every dashboard page; **Wrapped** — a seasonal year-in-review banner/overlay surfaced on Home.

---

## Global layout

```
┌─ Sidebar ─────────┬─ Top Bar (sticky) ──────────────────────────────┐
│  Logo             │  Page title              [Year] [Theme] [Export]  │
│  Nav items        ├──────────────────────────────────────────────────┤
│  ─────────        │  Context filters (month pills, search, etc.)     │
│  Connected        │  ─────────────────────────────────────────────── │
│  accounts list    │  Page content                                    │
└───────────────────┴──────────────────────────────────────────────────┘
```

**Mobile (< 768px):** Sidebar becomes bottom tab bar (Home, Spend, Activity, Accounts, Family).

---

## Page specifications

### Dashboard

- Month filter pills: Jan–Dec + All Year
- KPI grid (6 cards): Total Spent, Income, Net Savings, Avg Monthly, Top Category, CC Payments Excluded
- Full-width monthly trend chart
- Two-column: category donut + spend by account bar chart
- Dismissible smart alerts below charts

### Spend (`/categories`)

Tabbed page. The retired Money Flow reconciliation view (`/flow`) now redirects here.

- **Overview** (live): segmented proportional spend bar; category list (name, share %, amount, vs prior-month delta); multi-line category trend chart
- **Merchants** (preview): top merchants by lifetime/period spend
- **Patterns** (preview): average spend by day of week + detected spending patterns (weekend, post-payday, late-night)

### Transactions / Activity

- Filter pills: All, Expenses, Income, Transfers
- Search by merchant, category, account
- Table: date, merchant, category, account, amount
- Transfer rows visually distinct; click row to re-categorize

### Accounts & Debt (`/accounts`)

The standalone Debt dashboard was merged here (`/debt` redirects to `/accounts`); credit/liability detail now lives on each card instead of a separate page.

- **Debt-totals KPI strip** (shown only when credit accounts exist): total balance, statement balance, min due, utilization
- **Accounts grouped by type** — Checking · Savings · Cash & Other · Credit Cards · Trading & Investments — each group has an emoji header, count, and summed total
- **Account card** (colored header + slim footer):
  - Header: name/mask, balance, status icon (Live / Imported / Reconnect required / Sync error / Overdue), last-synced date, and icon actions
  - Credit cards progressively reveal liability detail as Plaid syncs it: statement balance, minimum due + due date, last payment + date, APR, est. interest/mo
- **Header actions** are icon-only with tooltips: Cash flow, Refresh all accounts, Add account (Plaid Link `icon` variant)
- **Empty state** + dashed "Add another account" CTA open Plaid Link; reconnect surfaces when OAuth expired

### Hub pages (Plan, Wealth, Insights, Protect)

- Shared tabbed shell (`PreviewHub`); each tab is a self-contained feature panel that owns its own preview banner
- Net Worth and Investments use real account balances; their trend/holdings detail remain flagged preview
- See the IA table for the tab list per hub

---

## Responsive breakpoints

| Breakpoint | Layout change |
|------------|---------------|
| < 768px | Bottom nav; KPIs 2-col; charts full-width |
| 768–1024px | Sidebar visible; charts single column |
| > 1024px | Full 2-col chart grid; KPI 3-col |

---

## Loading & error states

- **Skeleton loaders** match final layout shape during data fetch
- **Empty accounts:** CTA to connect first account on Dashboard and Accounts
- **Plaid item error:** Banner + Reconnect on Accounts and affected pages
- **Sync in progress:** Subtle “Syncing…” indicator in top bar

---

## API dependency

All data comes from the backend REST API — see [api-contract.md](api-contract.md). The UI must not embed business rules for reconciliation or categorization.
