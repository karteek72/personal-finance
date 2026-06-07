# UI Folder Structure

Current layout of the Next.js web app. Update this doc whenever routes or top-level component groups change.

## Information architecture (navigation)

The sidebar is a single sectioned list (no separate "Preview" group). Routes marked **(redirect)** keep old links working; routes marked **(preview)** are interactive mockups built on illustrative data.

| Section | Route | Page | Notes |
|---------|-------|------|-------|
| Overview | `/` | Home | KPIs, net savings hero, account-balance rollup, seasonal Wrapped banner |
| Overview | `/transactions` | Activity | Live transaction list |
| Overview | `/categories` | Spend | Tabbed: **Overview** (live) · **Merchants** (preview) · **Patterns** (preview) |
| Money | `/plan` | Plan | Hub (preview): Budgets & Goals · Calendar · Forecast · Recurring (subs + leaks) |
| Money | `/wealth` | Wealth | Hub: **Net Worth** (live) · **Investments** (live balances) · FIRE (preview) · Time Machine (preview) |
| Money | `/accounts` | Accounts & Debt | Connected accounts grouped by type + progressive credit/liability detail on tiles |
| Insights | `/understand` | Insights | Hub (preview): Wellness · Spending DNA · Behavioral |
| Insights | `/protect` | Protect | Hub (preview): Resilience · Inflation |
| — | `/family` | Family | Household members + shared spend |
| — | `/flow` | → `/categories` | (redirect) retired Money Flow route |
| — | `/debt` | → `/accounts` | (redirect) Debt merged into Accounts |

Global, non-route UI: **Coach** is a floating assistant (FAB) mounted in the dashboard layout; **Wrapped** is a seasonal banner/overlay on Home.

## Folder tree

```
ui/
├── README.md
├── STRUCTURE.md
├── package.json
└── src/
    ├── app/
    │   ├── layout.tsx            # Root layout, fonts, providers
    │   ├── globals.css           # Tailwind + token imports
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx        # Sidebar + top bar shell; mounts CoachAssistant; PAGE_TITLES map
    │       ├── page.tsx          # Home
    │       ├── transactions/page.tsx
    │       ├── categories/page.tsx   # Spend (tabbed: Overview/Merchants/Patterns)
    │       ├── plan/page.tsx         # Plan hub
    │       ├── wealth/page.tsx       # Wealth hub (was /grow)
    │       ├── accounts/page.tsx     # Accounts & Debt (renders AccountsView)
    │       ├── understand/page.tsx   # Insights hub
    │       ├── protect/page.tsx      # Protect hub
    │       ├── family/page.tsx
    │       ├── flow/page.tsx         # redirect → /categories
    │       └── debt/page.tsx         # redirect → /accounts
    ├── components/
    │   ├── ui/                   # Design system primitives (kpi-card, async-panel, page-header, icon-button, …)
    │   ├── charts/               # Interactive charts + spend/category analytics panels
    │   ├── layout/               # sidebar.tsx (sectioned nav), top-bar.tsx, mobile-nav.tsx, user-menu.tsx
    │   ├── accounts/
    │   │   ├── accounts-view.tsx          # grouped tiles, progressive liability detail, debt-totals strip
    │   │   └── account-balance-summary.tsx
    │   ├── debt/                 # (credit-debt logic now lives on account tiles; hook still in hooks/)
    │   ├── plaid/                # plaid-link-button.tsx (default/dashed/icon variants)
    │   ├── categories/ · transactions/ · notifications/ · family/
    │   └── preview/              # Roadmap/novel-feature mockups (illustrative data)
    │       ├── preview-hub.tsx           # tabbed shell for hub pages
    │       ├── coach-assistant.tsx       # global floating AI coach
    │       ├── wrapped-banner.tsx        # seasonal year-in-review
    │       └── panels/                   # one component per feature, suffixed *-panel.tsx
    │           ├── budgets · calendar · forecast · recurring (subs+leaks)
    │           ├── net-worth · investments · fire · time-machine
    │           ├── wellness · dna · behavioral · merchants · patterns
    │           └── resilience · inflation · subscriptions · leaks
    ├── hooks/                    # use-accounts, use-credit-debt, use-summary, use-chart-data, use-theme, …
    │   └── use-features.ts       # consolidated feature hooks: useNetWorth/useInvestments/useFire/useBudgets/
    │                             #   useRecurring/useCalendar/useForecast/useWellness/useDna/usePatterns/
    │                             #   useBehavioral/useMerchants/useInflation/useResilience/useCoach/useWrapped
    ├── lib/                      # api-client, mock-api, format-money, date-ranges, categories, notifications
    ├── mocks/                    # generated demo JSON for NEXT_PUBLIC_USE_MOCKS (built by backend db:gen-mock)
    ├── providers/               # query-provider, auth-provider
    ├── stores/                  # zustand (view-mode, …)
    └── types/
        └── api.ts                # Mirrors docs/design/api-contract.md (incl. wealth/planning/insights/protect/coach/wrapped)
```

## Conventions

- **Hub pages** compose feature panels via `preview/preview-hub.tsx`; each panel owns its own preview banner so live and mock tabs can mix.
- **Preview vs live:** every panel consumes a hook (`use-features.ts`) that resolves to the live API or, when `NEXT_PUBLIC_USE_MOCKS=true`, the generated demo dataset in `src/mocks/`. Keep the amber preview banner only where data is still illustrative (e.g. peer benchmarks, transaction-level tagging, what-if calculators).
- **No duplicate information** — every metric has a single canonical home (e.g., credit statement/min-due lives on the account tile, not a separate page).
- **Icon-first actions** — toolbar/action controls render as icon buttons with `title` + `aria-label` tooltips; keep text for data, headings, and primary empty-state CTAs.
- **Server Components by default** — add `"use client"` only for interactivity (charts, Plaid Link, hubs, theme toggle).
- **One component per file** — PascalCase export matching filename.
- **No business logic** — reconciliation and categorization rules live in backend only.
