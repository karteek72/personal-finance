# Design System

**Product:** SpendFlow (Nexus-inspired)  
**Last Updated:** May 2026

**Platform-agnostic tokens:** [design-tokens.json](design-tokens.json) — single source for web (`ui/`) and iPhone (`ios/`).  
**Mobile-specific patterns:** [mobile-patterns.md](mobile-patterns.md)

Implement web tokens as CSS custom properties in `ui/src/styles/tokens.css` (planned). Use Tailwind v4 `@theme` to map tokens. iOS maps the same JSON to Xcode Asset Catalog — see [mobile-ios.md](../architecture/mobile-ios.md).

---

## Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| Body, labels | Inter | 14–16px | 400, 500 |
| Numbers, amounts | JetBrains Mono | 12–22px | 400, 500 |
| Section headings | Inter | 18–24px | 600 |
| Page title | Inter | 22–28px | 700 |

**Rule:** All monetary values use tabular numerals (`font-variant-numeric: tabular-nums`).

---

## Color tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-primary` | `#01696f` | `#4f98a3` | CTAs, active nav, savings |
| `--color-danger` | `#c0392b` | `#e05c4a` | Expenses, overspend alerts |
| `--color-success` | `#437a22` | `#6daa45` | Income, positive delta |
| `--color-warning` | `#b07a00` | `#e8af34` | Warnings, budget nearing limit |
| `--color-bg` | `#f7f6f2` | `#0f0e0d` | Page background |
| `--color-surface` | `#f9f8f5` | `#161513` | Cards, panels |
| `--color-border` | `#d4d1ca` | `#2e2d2b` | Dividers |

Semantic mapping:

- Expense amounts → danger
- Income / positive delta → success
- Transfers / info → primary or neutral
- Alerts → warning or danger by severity

---

## Spacing & radius

- Base grid: **4px**
- Card padding: **16–20px**
- Section gap: **16–24px**
- Border radius: **6px** (cards), **9999px** (pills)

---

## Component library

| Component | Location (planned) | Behavior |
|-----------|-------------------|----------|
| `KPICard` | `ui/src/components/ui/kpi-card.tsx` | Value + delta vs prior period + optional sparkline |
| `TrendChart` | `ui/src/components/charts/trend-chart.tsx` | Bar/line toggle; tabular tooltips |
| `DonutChart` | `ui/src/components/charts/donut-chart.tsx` | 60% cutout; legend right |
| `CategoryRow` | `ui/src/components/categories/category-row.tsx` | Animated bar; click → transactions filter |
| `TransactionRow` | `ui/src/components/transactions/transaction-row.tsx` | Category dot, merchant, mono amount, type badge |
| `PlaidLinkButton` | `ui/src/components/plaid/plaid-link-button.tsx` | Opens Plaid Link; success/error callbacks |
| `AlertBanner` | `ui/src/components/ui/alert-banner.tsx` | Dismissible; severity color; optional CTA |
| `SkeletonLoader` | `ui/src/components/ui/skeleton.tsx` | Shimmer; matches target layout |

### Component rules

- Presentational components receive data via props — no direct `fetch` in leaf components
- Charts accept typed series data from hooks or server components
- All interactive elements need visible focus states (keyboard accessible)

---

## Icons & imagery

- No emoji as UI icons
- Institution logos from Plaid metadata when available; fallback to initials avatar
- Flat surfaces — no box shadows; use border + surface contrast for elevation

---

## Dark mode

- Class strategy: `html.dark` or `[data-theme="dark"]` on root
- Persist preference in `localStorage`; respect `prefers-color-scheme` on first visit
- Theme toggle in top bar

---

## Category colors (15 categories)

Stable hues are defined in [design-tokens.json](design-tokens.json) under `categories[]`. Implement in:

- Web: `ui/src/lib/category-colors.ts` (import or generate from JSON)
- iOS: `ios/SpendFlow/DesignSystem/CategoryColor.swift` (generate from JSON)

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
13. Financial  
14. Income  
15. Transfers (internal)
