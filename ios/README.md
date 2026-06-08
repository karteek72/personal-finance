# SpendFlow iOS

Native iPhone app for SpendFlow. Consumes the same backend REST API as the web client.

**Status:** Phase 4 parity shell — 6-tab navigation, Explore hub with 25 feature screens, Swift Charts analytics, Plaid + SnapTrade linking, statement import, household invites, in-app notifications, Coach Q&A, and GDPR export.

**Stack:** SwiftUI, Google Sign-In, LinkKit, URLSession, Swift Charts

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

open SpendFlow.xcodeproj
```

### API host

Default for Debug and Release builds:

`https://spendflow-api.stockpulse.win/api/v1`

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

1. Create an **iOS OAuth client** in Google Cloud with your bundle ID; save plist as `SpendFlow/Resources/GoogleService-Info.plist`.
2. Use your existing **Web OAuth client** for `GOOGLE_SERVER_CLIENT_ID` in `Config/Debug.xcconfig`.
3. Set Info.plist URL scheme to the iOS `REVERSED_CLIENT_ID` from the plist.

### Plaid Link (native)

The **Wallet** tab uses [LinkKit](https://github.com/plaid/plaid-link-ios-spm):

1. Tap **Link a bank** → `POST /plaid/link-token` with `platform: "ios"`.
2. LinkKit presents Plaid UI.
3. On success → `POST /plaid/exchange-token` and refresh accounts.

**Reconnect:** accounts with `reauth_required` show a reconnect button that requests an update-mode link token via `itemId`.

**Sync all:** `POST /plaid/sync` refreshes all Plaid items in the background.

### SnapTrade (brokerages)

**Link brokerage (SnapTrade)** opens the SnapTrade portal and completes via `POST /snaptrade/complete`.

### Teller

A **Connect with Teller** button verifies `GET /teller/config` availability. Native Teller Connect enrollment is a placeholder — use the web client to link Teller accounts until the iOS SDK flow ships.

### Deep links

Household invites open via `spendflow://invite?token=…` and present `AcceptInviteView` (preview + accept after sign-in).

---

## App capabilities

| Area | Features |
|------|----------|
| **Tabs** | Home dashboard, Money Flow, Categories, Transactions, Wallet, Explore |
| **Analytics** | Wellness, DNA, Patterns, Behavioral, Merchants (income sub-tab), charts with axes |
| **Wealth** | Net worth, Investments (KPIs, sector/allocation charts, stocks/options/behavioral tabs, trim-losers), Time Machine, FIRE |
| **Plan** | Budgets, Recurring, Calendar, Forecast (weather hero + 7-day strip + balance chart) |
| **Protect** | Resilience (metric envelope), Inflation, Credit & Debt |
| **Household** | Members, accounts, invite accept deep link |
| **Import** | QFX/CSV/PDF upload, account mapping, retry/cancel/replace |
| **Coach** | Monthly narrative + interactive Ask Coach chat |
| **Settings** | Profile, notifications, Face ID, GDPR export (`GET /auth/export`), legal pages |
| **Notifications** | In-app bell + history from `/insights/alerts`, read/dismiss persisted in UserDefaults |

---

## Project layout

See [STRUCTURE.md](STRUCTURE.md).

---

## Design

Visual language matches the web UI: purple–pink gradients, glass cards, floating bottom nav, shared design tokens.

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

## Related docs

| Document | Purpose |
|----------|---------|
| [mobile-ios.md](../docs/architecture/mobile-ios.md) | Architecture & boundaries |
| [mobile-patterns.md](../docs/design/mobile-patterns.md) | Keychain, push, SwiftUI patterns |
| [api-contract.md](../docs/design/api-contract.md) | REST endpoints |
| [design-tokens.json](../docs/design/design-tokens.json) | Shared colors & navigation |
