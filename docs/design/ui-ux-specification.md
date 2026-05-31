# UI/UX Specification

**Product:** SpendFlow  
**Last Updated:** May 2026

Visual tokens and components: [design-system.md](design-system.md)  
Interactive reference: [SpendFlow UI Mockup canvas](/home/karteek/.cursor/projects/opt-personal-finance/canvases/spendflow-ui-mockup.canvas.tsx)

---

## Design principles

- **Data-first, decoration-last** — every visual element carries information
- **Compact density** — show the dashboard without excessive scrolling; whitespace for hierarchy only
- **Mobile-first** — sidebar collapses to bottom nav on small screens

---

## Information architecture

| Route | Page | Primary actions |
|-------|------|-----------------|
| `/` | Dashboard | View KPIs, trends, alerts |
| `/flow` | Money Flow | Reconciliation view, income/expense/net |
| `/categories` | Categories | Category breakdown and trends |
| `/transactions` | Transactions | Search, filter, re-categorize |
| `/accounts` | Accounts | Connect/reconnect Plaid, view balances |
| `/login` | Login | Auth |
| `/register` | Register | Auth |

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

**Mobile (< 768px):** Sidebar becomes bottom tab bar (Dashboard, Flow, Categories, Transactions, Accounts).

---

## Page specifications

### Dashboard

- Month filter pills: Jan–Dec + All Year
- KPI grid (6 cards): Total Spent, Income, Net Savings, Avg Monthly, Top Category, CC Payments Excluded
- Full-width monthly trend chart
- Two-column: category donut + spend by account bar chart
- Dismissible smart alerts below charts

### Money Flow

- Green reconciliation banner (always visible)
- Three columns: Income Sources | Bank Accounts | Credit Cards
- Combo chart: monthly income vs expenses vs net

### Categories

- Segmented proportional spend bar
- Category list: name, share %, amount, vs prior month delta
- Multi-line category trend chart

### Transactions

- Filter pills: All, Expenses, Income, Transfers
- Search by merchant, category, account
- Table: date, merchant, category, account, amount
- Transfer rows visually distinct; click row to re-categorize

### Accounts

- Grid of connected account cards
- Each card: institution name, type, balance, last synced, status
- Primary CTA: Connect Account (opens Plaid Link)
- Reconnect button when OAuth expired

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
