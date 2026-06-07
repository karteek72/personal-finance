# SpendFlow UI

Next.js 15 frontend for SpendFlow. Deploys as its own Podman container (`spendflow-ui`).

**Status:** Active. Core pages live; roadmap features ship as interactive preview hubs. See [STRUCTURE.md](STRUCTURE.md) for the route map and navigation IA.

---

## Stack (planned)

| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 15 | App Router, RSC, standalone output |
| React | 19 | UI |
| TypeScript | 5.x | Strict typing |
| Tailwind CSS | v4 | Styling with design tokens |
| TanStack Query | v5 | Server state / API cache |
| Zustand | v5 | Client UI state (theme, filters) |
| Chart.js | 4 | Dashboard charts |
| react-plaid-link | latest | Plaid Link integration |

---

## Responsibilities

- Render Home, Activity, Spend, Plan, Wealth, Accounts & Debt, Insights, Protect, and Family pages (see [STRUCTURE.md](STRUCTURE.md) for the full IA)
- Compose roadmap features into tabbed preview hubs; wire real data where cheap and flag still-mock sections
- Call backend REST API (`NEXT_PUBLIC_API_URL`) — no direct DB access
- Run Plaid Link in browser; send `public_token` to backend for exchange
- Dark/light theme, responsive layout (375px+)
- CSV export via backend stream endpoint

---

## Planned folder structure

See [STRUCTURE.md](STRUCTURE.md) for the full tree.

---

## Environment variables (planned)

```env
# .env.example
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PLAID_ENV=sandbox
```

Never put secrets (`PLAID_SECRET`, `DATABASE_URL`) in this service.

---

## Coding standards

- [.cursor/rules/ui-typescript.mdc](../.cursor/rules/ui-typescript.mdc)
- [Design system](../docs/design/design-system.md)
- [UI/UX spec](../docs/design/ui-ux-specification.md)
- [API contract](../docs/design/api-contract.md)

---

## Commands

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_USE_MOCKS=true by default
npm run dev          # http://localhost:3000
npm run build        # production build (standalone)
npm run lint
npm run typecheck
```

## Mock data mode

With `NEXT_PUBLIC_USE_MOCKS=true` (default in `.env.example`), all API calls use JSON fixtures in `src/mocks/` via `src/lib/mock-api.ts` (~150ms simulated delay). Set `NEXT_PUBLIC_USE_MOCKS=false` to call the real backend at `NEXT_PUBLIC_API_URL`.

### Production builds (M1)

`NEXT_PUBLIC_*` variables are **inlined at build time**. For production/container images:

- Set `NEXT_PUBLIC_USE_MOCKS=false` (or leave unset) **before** `npm run build`.
- `npm run build` runs `scripts/verify-production-build.mjs` and **fails** if mocks are enabled.
- Non-mock production bundles alias `mock-api` to a stub so fixture JSON is not shipped.

Never set `NEXT_PUBLIC_USE_MOCKS=true` in CI/CD for production images.

---

## Container notes

Production build uses Next.js `output: 'standalone'` for minimal Podman image. See [container-deployment.md](../docs/architecture/container-deployment.md).
