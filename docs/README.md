# SpendFlow Documentation

All product, design, and technical specifications live here. Application code lives in `ui/`, `ios/`, and `backend/`.

## Design (`design/`)

Requirements and UX artifacts — read these before implementing features.

| File | Audience | Contents |
|------|----------|----------|
| [product-requirements.md](design/product-requirements.md) | PM, engineers | Goals, MVP/V2 scope, KPIs, roadmap |
| [user-personas-and-scenarios.md](design/user-personas-and-scenarios.md) | Design, PM | Personas and daily-use flows |
| [ui-ux-specification.md](design/ui-ux-specification.md) | Design, frontend | Page layouts, navigation, responsive rules |
| [design-system.md](design/design-system.md) | Design, all clients | Tokens, typography, component specs |
| [design-tokens.json](design/design-tokens.json) | Design, web, iOS | Platform-agnostic color, type, category tokens |
| [mobile-patterns.md](design/mobile-patterns.md) | iOS engineers | Keychain, Plaid native, push, SwiftUI mapping |
| [api-contract.md](design/api-contract.md) | All clients, backend | Shared REST API contract |
| [statement-import-ui-and-security.md](design/statement-import-ui-and-security.md) | UI, backend | Import wizard, upload limits, encryption |

## Architecture (`architecture/`)

Technical decisions and deployment.

| File | Audience | Contents |
|------|----------|----------|
| [system-overview.md](architecture/system-overview.md) | Backend, DevOps | Stack, schema, Plaid, reconciliation |
| [mobile-ios.md](architecture/mobile-ios.md) | iOS, backend | iPhone app architecture, backend reuse |
| [data-security-compliance.md](architecture/data-security-compliance.md) | Backend, legal, DevOps | Encryption, GDPR/CCPA, Postgres migration |
| [repository-layout.md](architecture/repository-layout.md) | All engineers | Monorepo conventions |
| [container-deployment.md](architecture/container-deployment.md) | DevOps | Podman images, compose, networking |
| [import-parser-design.md](architecture/import-parser-design.md) | Backend | Universal QFX/CSV/PDF parsers, brokerage day-trade |
| [statement-import-and-plaid-bridge.md](architecture/statement-import-and-plaid-bridge.md) | Backend, PM | Import-first vs Plaid merge strategy |

## Development (`development/`)

Agent task coordination and implementation backlog.

| File | Audience | Contents |
|------|----------|----------|
| [TASK_BOARD.md](development/TASK_BOARD.md) | All engineers, agents | Status dashboard, next items, doc audit |
| [tasks.yaml](development/tasks.yaml) | Agents, automation | Machine-readable tasks with claim/complete workflow |
| [README.md](development/README.md) | Agents | How to claim and complete tasks |

## Archive

| File | Notes |
|------|-------|
| [archive/spendflow-prd-v1.md](archive/spendflow-prd-v1.md) | Original combined PRD (superseded by split docs) |

## Doc maintenance

When changing behavior:

1. Update the design doc first (or in the same PR as the code change).
2. Keep `api-contract.md` in sync with backend routes — all clients depend on it.
3. Update `design-tokens.json` when colors, categories, or navigation change — regenerate web/iOS mappings.
4. Version breaking API changes in the contract with a dated note.
