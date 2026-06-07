# SpendFlow Backend

Fastify API and background workers for SpendFlow. Deploys as Podman containers (`spendflow-api`, `spendflow-worker`).

**Status:** Not scaffolded yet — structure and rules only.

---

## Stack (planned)

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22 LTS | Runtime |
| Fastify | 5 | HTTP API |
| TypeScript | 5.x | Strict typing |
| Zod | 3.x | Request/env validation |
| Drizzle ORM | latest | PostgreSQL access |
| BullMQ | 5.x | Job queue |
| Plaid SDK | latest | Bank aggregation |
| jose / jsonwebtoken | — | JWT auth |

---

## Responsibilities

- REST API per [api-contract.md](../docs/design/api-contract.md)
- Plaid token exchange, sync, webhooks (HMAC verified)
- Reconciliation and categorization engines
- PostgreSQL persistence with user-scoped queries
- BullMQ workers for async sync jobs
- AES-256-GCM encryption for Plaid access tokens

---

## Planned folder structure

See [STRUCTURE.md](STRUCTURE.md) for the full tree.

---

## Environment variables (planned)

```env
# .env.example
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://spendflow:spendflow@localhost:5432/spendflow
REDIS_URL=redis://localhost:6380
JWT_SECRET=
ENCRYPTION_KEY=                    # 32-byte hex
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
APP_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
```

---

## Coding standards

- [.cursor/rules/backend-typescript.mdc](../.cursor/rules/backend-typescript.mdc)
- [System overview](../docs/architecture/system-overview.md)
- [API contract](../docs/design/api-contract.md)

---

## Commands (after scaffolding)

```bash
npm install
npm run dev          # API with hot reload :4000
npm run dev:worker   # BullMQ consumer
npm run build        # tsc → dist/
npm run db:migrate   # Drizzle migrations
npm run lint
npm run typecheck
```

---

## Container notes

API and worker share one image; worker runs `node dist/worker.js`. See [container-deployment.md](../docs/architecture/container-deployment.md).
