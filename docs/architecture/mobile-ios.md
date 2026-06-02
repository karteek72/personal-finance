# iPhone App Architecture

**Product:** SpendFlow  
**Last Updated:** May 2026  
**Status:** Phase 1 scaffolded — see `ios/README.md`

---

## Strategy

SpendFlow ships as a **native iPhone app** alongside the Next.js web client. Both are thin clients over the same backend REST API. The backend remains the single source of truth for users, Plaid tokens, transactions, reconciliation, and categorization.

**Recommended stack:** SwiftUI + Plaid Link iOS SDK (best iOS UX, Keychain, Swift Charts, APNs).  
**Alternative:** Expo / React Native if the team prioritizes shared TypeScript types with web — see [repository-layout.md](repository-layout.md).

---

## Multi-client architecture

```
┌─────────────┐     HTTPS      ┌─────────────────┐
│   Browser   │ ──────────────►│  ui (Next.js)   │
└─────────────┘                └────────┬────────┘
                                        │ REST /api/v1
┌─────────────┐                ┌────────▼────────┐
│  iPhone App │ ──────────────►│ backend (Fastify)│
│  (SwiftUI)  │                │  + workers       │
└──────┬──────┘                └────────┬────────┘
       │                                 │
       │ Plaid Link iOS SDK
       └────────────────────────────────►├── PostgreSQL
                                         ├── Redis / BullMQ
                                         └── Plaid API (server-side)
```

---

## Service boundaries

| Concern | iPhone app | Backend |
|---------|------------|---------|
| UI / navigation | Yes | No |
| Plaid Link UI (OAuth) | Native SDK on device | No |
| `public_token` → `access_token` exchange | Sends token to API | Yes — encrypt & store |
| Plaid `access_token` storage | **Never** | Encrypted in PostgreSQL |
| Transaction sync & webhooks | No | Worker |
| Reconciliation & categorization | No | Services |
| JWT access token | In memory (short-lived) | Issued |
| JWT refresh token | iOS Keychain | Validated & rotated |
| Push notification display | APNs | Sends via APNs |
| Offline transaction cache | Optional read-only | Source of truth |

---

## Plaid flow on iOS

Identical trust model to web — only the Link UI is native:

```
1. App → POST /api/v1/plaid/link-token  { platform: "ios" }
2. Backend → returns linkToken
3. App → Plaid Link iOS SDK (presented modally)
4. User completes bank OAuth (credentials never touch SpendFlow)
5. App receives public_token
6. App → POST /api/v1/plaid/exchange-token  { publicToken }
7. Backend encrypts access_token, stores in plaid_items, queues sync
8. App polls or receives push when initial sync completes
```

Plaid secrets (`PLAID_SECRET`) and decrypted access tokens **never** exist on the device.

---

## Design system on iOS

Visual consistency comes from shared tokens, not shared UI code.

| Asset | Source | iOS implementation |
|-------|--------|-------------------|
| Colors (light/dark) | [design-tokens.json](../design/design-tokens.json) | Xcode Asset Catalog color sets |
| Category chart colors | `categories[]` in tokens JSON | Swift `CategoryColor` enum |
| Typography scale | `typography.scale` in tokens JSON | SwiftUI `Font` + Dynamic Type |
| Money display | `typography.rules.tabularNumerals` | SF Mono or custom font + `.monospacedDigit()` |
| Navigation (5 tabs) | `navigation.primaryDestinations` | `TabView` |
| Components | [design-system.md](../design/design-system.md) | Reimplemented in SwiftUI |

See [mobile-patterns.md](../design/mobile-patterns.md) for iOS-specific UX (Keychain, Face ID, push, pull-to-refresh).

---

## Backend additions for mobile

Extend [api-contract.md](../design/api-contract.md) when implementing iOS:

| Endpoint | Purpose |
|----------|---------|
| `POST /plaid/link-token` with `{ platform: "ios" }` | Platform-specific Plaid Link config |
| `POST /devices` `{ apnsToken, platform: "ios" }` | Register for push |
| `DELETE /devices/:id` | Unregister on logout |
| Push fan-out from `/insights/alerts` | Background alert delivery |

**Auth:** Bearer access JWT (15–60 min) + refresh token in Keychain. No CORS on native clients; use HTTPS and optional certificate pinning in production.

---

## iPhone-specific features

| Feature | Implementation |
|---------|----------------|
| Tab bar navigation | 5 destinations from design tokens |
| Face ID / Touch ID | Local app unlock; optional before showing balances |
| Keychain | Refresh token: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` |
| Pull-to-refresh | Dashboard, Transactions, Accounts |
| Push notifications | Plaid reconnect required, overspend alerts, sync complete |
| Haptics | Light feedback on re-categorize confirm (optional) |
| Safe area / Dynamic Type | Standard SwiftUI layout |

---

## Repository layout (planned)

```
ios/
├── README.md
├── STRUCTURE.md
├── SpendFlow/                  # Xcode project / SwiftPM
│   ├── App/
│   ├── Features/               # Dashboard, Flow, Categories, ...
│   ├── DesignSystem/           # Generated or hand-mapped from design-tokens.json
│   ├── Services/               # APIClient, KeychainService, PlaidLinkCoordinator
│   └── Models/                 # Mirrors api-contract types
└── SpendFlowTests/
```

No Podman container for iOS — distributed via App Store. CI builds with Xcode / `xcodebuild`.

---

## Roadmap

| Phase | Scope |
|-------|-------|
| **1** | Web MVP + backend API (no iOS) |
| **2** | iOS shell: auth, Keychain, tab navigation, dashboard (read-only) |
| **3** | Native Plaid Link, all 5 screens, re-categorize |
| **4** | APNs push, Face ID, App Store submission |
| **5** | Widgets, Apple Watch (optional V2) |

---

## Related documents

- [mobile-patterns.md](../design/mobile-patterns.md)
- [design-tokens.json](../design/design-tokens.json)
- [data-security-compliance.md](data-security-compliance.md)
- [api-contract.md](../design/api-contract.md)
