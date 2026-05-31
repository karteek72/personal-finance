# Repository Layout

**Last Updated:** May 2026

---

## Top-level structure

```
personal-finance/
├── README.md                 # Project entry point
├── AGENTS.md                 # AI agent instructions
├── docs/
│   ├── design/               # Product, UX, tokens, API contract
│   └── architecture/         # Technical, mobile, security, deployment
├── ui/                       # Web frontend (Podman: spendflow-ui)
├── ios/                      # iPhone app (App Store; no Podman)
├── backend/                  # API + workers (Podman: spendflow-api)
└── .cursor/rules/            # Cursor coding standards
```

---

## Service ownership

| Concern | Owner |
|---------|-------|
| Web pages, components, charts | `ui/` |
| iPhone app, SwiftUI, Keychain | `ios/` |
| REST API, auth, Plaid, DB, workers | `backend/` |
| API shape | `docs/design/api-contract.md` (all clients) |
| Design tokens | `docs/design/design-tokens.json` → `ui/` + `ios/` |
| Security & compliance | `docs/architecture/data-security-compliance.md` |

**No shared npm package in Phase 1.** Duplicate API types in `ui/src/types/api.ts`, `backend/src/types/`, and Swift models in `ios/`; keep in sync with the contract doc. Consider `packages/shared/` later for TS-only sharing between web and backend.

---

## Naming conventions

| Item | Convention | Example |
|------|------------|---------|
| Folders | kebab-case | `money-flow/` |
| React components | PascalCase file + export | `kpi-card.tsx` → `KpiCard` |
| Swift types | PascalCase | `KpiCard.swift` → `KpiCard` |
| Backend modules | kebab-case file | `sync-transactions.job.ts` |
| API routes | kebab-case path segments | `/transactions/by-category` |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL` |
| DB tables | snake_case | `plaid_items` |
| TypeScript types | PascalCase | `TransactionSummary` |

---

## Git workflow

- `main` — stable
- Feature branches: `feat/ui-dashboard`, `feat/ios-auth`, `feat/backend-plaid-sync`
- Docs-only changes: `docs/update-api-contract`

Keep UI, iOS, and backend changes in separate commits when possible for cleaner review.

---

## Future additions (not yet created)

```
containers/
├── compose.yaml              # Podman Compose — postgres, redis, ui, api, worker
├── Containerfile.ui
├── Containerfile.backend
└── README.md

.github/workflows/            # CI: lint, typecheck, test per service + xcodebuild
```

These will be added in Phase 1 scaffolding, not before.

---

## Related documents

- [UI structure](../../ui/STRUCTURE.md)
- [iOS structure](../../ios/STRUCTURE.md)
- [Backend structure](../../backend/STRUCTURE.md)
- [Mobile iOS](mobile-ios.md)
- [Data security & compliance](data-security-compliance.md)
- [Container deployment](container-deployment.md)
