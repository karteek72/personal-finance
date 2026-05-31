# SpendFlow UI

Next.js 15 frontend for SpendFlow. Deploys as its own Podman container (`spendflow-ui`).

**Status:** Not scaffolded yet — structure and rules only.

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

- Render dashboard, money flow, categories, transactions, accounts pages
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

## Commands (after scaffolding)

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (standalone)
npm run lint
npm run typecheck
```

---

## Container notes

Production build uses Next.js `output: 'standalone'` for minimal Podman image. See [container-deployment.md](../docs/architecture/container-deployment.md).
