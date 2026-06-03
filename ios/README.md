# SpendFlow iOS

Native iPhone app for SpendFlow. Consumes the same backend REST API as the web client.

**Status:** Phase 1 + native Plaid Link — auth, five tabs, bank linking via LinkKit.  
**Stack:** SwiftUI, Google Sign-In, LinkKit, URLSession

---

## Prerequisites

- Xcode 16+ with iOS 17 SDK
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`
- SpendFlow API at `https://spendflow-api.stockpulse.win/api/v1`

---

## First-time setup

```bash
cd ios

# Generate SpendFlow.xcodeproj from project.yml
xcodegen generate

# Optional: local overrides (device testing, Google client ID)
cp Config/Local.xcconfig.example Config/Local.xcconfig
# Edit Config/Local.xcconfig — e.g. Google client ID, or localhost override

open SpendFlow.xcodeproj
```

### API host

Default for Debug and Release builds:

`https://spendflow-api.stockpulse.win/api/v1`

Example endpoint: `https://spendflow-api.stockpulse.win/api/v1/accounts`

To point at a local backend, create `Config/Local.xcconfig`:

```
API_BASE_URL = http:/$()/127.0.0.1:4000/api/v1
```

### Google Sign-In

Google uses **two** client IDs:

| Variable | Type | Value |
|----------|------|--------|
| `GOOGLE_CLIENT_ID` | iOS | From `GoogleService-Info.plist` — native sign-in + URL scheme |
| `GOOGLE_SERVER_CLIENT_ID` | Web | Same as backend `GOOGLE_CLIENT_ID` — ID token audience for `/auth/google` |

1. Create an **iOS OAuth client** in Google Cloud with your bundle ID (default: `com.mx.spendflow` in `Config/Debug.xcconfig`; override in `Config/Local.xcconfig`); save plist as `SpendFlow/Resources/GoogleService-Info.plist`.
2. Use your existing **Web OAuth client** for `GOOGLE_SERVER_CLIENT_ID` in `Config/Debug.xcconfig` (must match `containers/.env` `GOOGLE_CLIENT_ID`).
3. Set Info.plist URL scheme to the iOS `REVERSED_CLIENT_ID` from the plist.

The app configures `GIDConfiguration(clientID:serverClientID:)` so tokens sent to the API match what the backend verifies.

`Info.plist` allows local networking when using a localhost override in `Local.xcconfig`.

### Plaid Link (native)

The **Wallet** tab uses [LinkKit](https://github.com/plaid/plaid-link-ios-spm) (Swift Package Manager, 6.3+):

1. Tap **Link a bank** → app calls `POST /plaid/link-token` with `platform: "ios"`.
2. LinkKit presents the Plaid UI with the returned `linkToken`.
3. On success, app calls `POST /plaid/exchange-token` and refreshes accounts.

Backend Plaid env vars (`PLAID_CLIENT_ID`, `PLAID_SECRET`, etc.) live in `containers/.env` — same as web.

**OAuth banks (Chase, etc.):** require **Associated Domains** on your App ID. The default `SpendFlow.entitlements` is empty so Personal Team builds work out of the box. Plaid Link still works for sandbox institutions that use username/password.

When you need OAuth banks on device:

1. [Apple Developer](https://developer.apple.com/account) → **Identifiers** → `com.mx.spendflow` → enable **Associated Domains** → Save.
2. Copy `SpendFlow-OAuth.entitlements.example` → `SpendFlow.entitlements` (or merge the `com.apple.developer.associated-domains` entry).
3. In Xcode: **Signing & Capabilities** → verify Associated Domains shows `applinks:spendflow.stockpulse.win`. Delete and re-download the provisioning profile if needed (**Product → Clean Build Folder**, then rebuild).
4. Register `https://spendflow.stockpulse.win/plaid/oauth` in the [Plaid Dashboard](https://dashboard.plaid.com) (same as web `PLAID_REDIRECT_URI`).
5. Host `https://spendflow.stockpulse.win/.well-known/apple-app-site-association` with your Team ID and bundle ID.

---

## Project layout

See [STRUCTURE.md](STRUCTURE.md).

---

## Design

Visual language matches the **web UI** (`ui/src/styles/tokens.css`): purple–pink gradients, lavender background, glass cards, floating bottom nav.

Regenerate the app icon after brand tweaks:

```bash
cd ios/scripts && python3 -m venv .venv && .venv/bin/pip install pillow
.venv/bin/python generate-app-icon.py
```

## Commands

```bash
# Regenerate Xcode project after project.yml changes
xcodegen generate

# CLI build (simulator)
xcodebuild -scheme SpendFlow -destination 'platform=iOS Simulator,name=iPhone 16' build

# Unit tests
xcodebuild -scheme SpendFlow -destination 'platform=iOS Simulator,name=iPhone 16' test
```

---

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Auth, Keychain, tab nav, dashboard + read screens | Done |
| 2 | Plaid Link iOS SDK, re-categorize | **Plaid Link done**; re-categorize planned |
| 3 | Swift Charts analytics, household/family | Planned |
| 4 | APNs push, Face ID, App Store | Planned |

---

## Related docs

| Document | Purpose |
|----------|---------|
| [mobile-ios.md](../docs/architecture/mobile-ios.md) | Architecture & boundaries |
| [mobile-patterns.md](../docs/design/mobile-patterns.md) | Keychain, push, SwiftUI patterns |
| [api-contract.md](../docs/design/api-contract.md) | REST endpoints |
| [design-tokens.json](../docs/design/design-tokens.json) | Shared colors & navigation |
