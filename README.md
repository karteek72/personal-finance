# SpendFlow

Personal finance platform for day-to-day spending visibility — automatic bank sync, transfer reconciliation, and actionable insights.

## Repository layout

```
spendflow/
├── docs/           # Product, design, and architecture documentation
│   ├── design/     # Requirements, UX, design tokens, API contract
│   └── architecture/
├── ui/             # Next.js web app (Podman container)
├── ios/            # SwiftUI iPhone app (App Store)
├── backend/        # Fastify API + workers (Podman container)
└── .cursor/rules/  # AI and developer coding standards
```

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/design/product-requirements.md](docs/design/product-requirements.md) | MVP scope, goals, personas, roadmap |
| [docs/design/design-tokens.json](docs/design/design-tokens.json) | Shared colors, categories, navigation (web + iOS) |
| [docs/design/mobile-patterns.md](docs/design/mobile-patterns.md) | iPhone UX: Keychain, Plaid, push |
| [docs/design/api-contract.md](docs/design/api-contract.md) | REST contract for all clients |
| [docs/architecture/mobile-ios.md](docs/architecture/mobile-ios.md) | iPhone architecture |
| [docs/architecture/data-security-compliance.md](docs/architecture/data-security-compliance.md) | Encryption, GDPR/CCPA, Postgres migration |
| [docs/architecture/system-overview.md](docs/architecture/system-overview.md) | Stack, data model, integrations |
| [docs/architecture/container-deployment.md](docs/architecture/container-deployment.md) | Podman deployment plan |

Full index: [docs/README.md](docs/README.md)

## Services

| Service | Folder | Runtime | Deploy |
|---------|--------|---------|--------|
| Web UI | `ui/` | Next.js 15 | Podman |
| iPhone | `ios/` | SwiftUI | App Store |
| API | `backend/` | Fastify 5 + TypeScript | Podman |
| Worker | `backend/` | BullMQ consumer | Podman (same image) |

Infrastructure (PostgreSQL, Redis) runs as separate containers — see [container-deployment.md](docs/architecture/container-deployment.md).

## Status

**Phase 0 — Project foundation.** Structure and rules are in place. Application scaffolding has not started yet.

## Development (upcoming)

Once scaffolding begins:

```bash
# Web UI
cd ui && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev

# iOS (Phase 4)
open ios/SpendFlow.xcodeproj
```

See [AGENTS.md](AGENTS.md) for AI agent guidelines.
