# SpendFlow — Agent Guidelines

Instructions for AI agents working in this repository.

## Project shape

SpendFlow is a **multi-client monorepo** with one backend:

- **`ui/`** — Next.js 15 web app. Consumes backend REST API. No DB or Plaid secrets.
- **`ios/`** — SwiftUI iPhone app. Same API; Keychain for refresh tokens; native Plaid Link.
- **`backend/`** — Fastify API, Drizzle ORM, Plaid integration, BullMQ workers. Owns all secrets and PostgreSQL.

Do not colocate business logic in Next.js API routes. All clients are thin.

## Before writing code

1. Check **`docs/development/TASK_BOARD.md`** — claim a task via `npm run task -- claim TASK-ID your-agent-name` before implementing.
2. Read the relevant doc under `docs/design/` or `docs/architecture/` (listed in each task's `source_docs`).
3. Follow `.cursor/rules/` — project rules always apply; UI/backend rules apply per folder.
4. Match planned structure in `ui/STRUCTURE.md`, `backend/STRUCTURE.md`, or `ios/STRUCTURE.md`.
5. Update `design-tokens.json` when changing shared colors, categories, or navigation.
6. Prefer minimal, focused diffs. Mark tasks done: `npm run task -- complete TASK-ID your-agent-name`.

## Documentation locations

| Topic | Path |
|-------|------|
| What to build (MVP) | `docs/design/product-requirements.md` |
| Screen layouts | `docs/design/ui-ux-specification.md` |
| Shared design tokens | `docs/design/design-tokens.json` |
| iPhone patterns | `docs/design/mobile-patterns.md` |
| REST endpoints & types | `docs/design/api-contract.md` |
| iPhone architecture | `docs/architecture/mobile-ios.md` |
| Security & compliance | `docs/architecture/data-security-compliance.md` |
| DB, Plaid, reconciliation | `docs/architecture/system-overview.md` |
| Podman / containers | `docs/architecture/container-deployment.md` |

## TypeScript standards (ui/ + backend/)

- **Strict mode** everywhere.
- **No `any`**. Use `unknown` + narrowing at boundaries.
- **Validate at edges** — Zod for API bodies and env vars.
- **Errors** — typed error classes; never swallow exceptions.

## Service boundaries

```
Browser → ui (Next.js)  ──┐
iPhone  → ios (SwiftUI) ──┼──► backend (Fastify REST) → PostgreSQL
                          │         ↓
                          │    Redis / BullMQ → Plaid
Plaid Link (web/iOS SDK) ─┘
```

- Plaid **Link** runs in browser or iOS SDK; **token exchange** is backend-only.
- Never expose `PLAID_SECRET`, `ENCRYPTION_KEY`, or `DATABASE_URL` to `ui/` or `ios/`.

## Commits & scope

- Do not commit `.env` files or secrets.
- One concern per PR when possible (docs, ui, ios, backend separable).
- Only commit when explicitly asked.

## Current phase

Structure and rules only. Phase 1: backend schema + health endpoint, then web UI shell. iOS starts Phase 4 per [mobile-ios.md](docs/architecture/mobile-ios.md).
