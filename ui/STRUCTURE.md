# UI Folder Structure (Planned)

Target layout for Phase 1 scaffolding. Do not create files outside this structure without updating this doc.

```
ui/
├── README.md
├── STRUCTURE.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── .env.example
├── public/
│   └── fonts/                    # Inter, JetBrains Mono (self-hosted)
└── src/
    ├── app/
    │   ├── layout.tsx            # Root layout, fonts, providers
    │   ├── globals.css           # Tailwind + token imports
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx        # Sidebar + top bar shell
    │       ├── page.tsx          # Dashboard
    │       ├── flow/page.tsx
    │       ├── categories/page.tsx
    │       ├── transactions/page.tsx
    │       └── accounts/page.tsx
    ├── components/
    │   ├── ui/                   # Design system primitives
    │   │   ├── kpi-card.tsx
    │   │   ├── alert-banner.tsx
    │   │   ├── skeleton.tsx
    │   │   └── ...
    │   ├── charts/
    │   │   ├── trend-chart.tsx
    │   │   └── donut-chart.tsx
    │   ├── layout/
    │   │   ├── sidebar.tsx
    │   │   ├── top-bar.tsx
    │   │   └── mobile-nav.tsx
    │   ├── plaid/
    │   │   └── plaid-link-button.tsx
    │   ├── categories/
    │   │   └── category-row.tsx
    │   └── transactions/
    │       └── transaction-row.tsx
    ├── hooks/
    │   ├── use-transactions.ts
    │   ├── use-summary.ts
    │   └── use-theme.ts
    ├── lib/
    │   ├── api-client.ts         # Typed fetch wrapper
    │   ├── category-colors.ts
    │   └── format-money.ts
    ├── providers/
    │   ├── query-provider.tsx
    │   └── auth-provider.tsx
    ├── styles/
    │   └── tokens.css            # CSS custom properties from design-system.md
    └── types/
        └── api.ts                # Mirrors docs/design/api-contract.md
```

## Conventions

- **Server Components by default** — add `"use client"` only for interactivity (charts, Plaid Link, theme toggle)
- **One component per file** — PascalCase export matching filename
- **Colocate tests** — `kpi-card.test.tsx` next to component (when tests added)
- **No business logic** — reconciliation and categorization rules live in backend only
