# SpendFlow iOS

Native iPhone app for SpendFlow. Consumes the same backend REST API as the web client.

**Status:** Not scaffolded yet — structure and rules only.  
**Stack:** SwiftUI, Plaid Link iOS SDK, Swift Charts

---

## Responsibilities

- Native UI for Dashboard, Money Flow, Categories, Transactions, Accounts
- Plaid Link via iOS SDK (`public_token` sent to backend only)
- JWT refresh token in Keychain; Face ID optional app unlock
- APNs push for alerts (Phase 4)
- **No** Plaid secrets, access tokens, or direct database access

---

## Design & architecture docs

| Document | Purpose |
|----------|---------|
| [mobile-ios.md](../docs/architecture/mobile-ios.md) | Architecture, backend boundary, roadmap |
| [mobile-patterns.md](../docs/design/mobile-patterns.md) | Keychain, push, SwiftUI token mapping |
| [design-tokens.json](../docs/design/design-tokens.json) | Shared colors, categories, navigation |
| [api-contract.md](../docs/design/api-contract.md) | REST endpoints and types |

---

## Planned folder structure

See [STRUCTURE.md](STRUCTURE.md).

---

## Distribution

App Store — not deployed via Podman. Backend API URL configured per build configuration (Debug/Release).

---

## Commands (after scaffolding)

```bash
# Open in Xcode
open SpendFlow.xcodeproj

# CLI build
xcodebuild -scheme SpendFlow -destination 'platform=iOS Simulator,name=iPhone 16'
```
