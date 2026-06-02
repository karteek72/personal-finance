# SpendFlow iOS

Native iPhone app for SpendFlow. Consumes the same backend REST API as the web client.

**Status:** Phase 1 scaffold — auth, five tabs, read-only financial screens.  
**Stack:** SwiftUI, Google Sign-In, URLSession, Swift Charts (Phase 2)

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

1. Create an **iOS OAuth client** in Google Cloud Console (bundle ID: `com.spendflow.app`).
2. Download the plist Google provides and save it as:

   `ios/SpendFlow/Resources/GoogleService-Info.plist`

   (Already added for this project — replace if you regenerate the iOS client.)

3. Ensure `Info.plist` **URL scheme** matches `REVERSED_CLIENT_ID` from that plist:

   `com.googleusercontent.apps.<your-client-prefix>`

4. Add the same **CLIENT_ID** to backend `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_IDS` in `containers/.env`.

`Info.plist` allows local networking when using a localhost override in `Local.xcconfig`.

---

## Project layout

See [STRUCTURE.md](STRUCTURE.md).

---

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
| 1 | Auth, Keychain, tab nav, dashboard + read screens | **Current** |
| 2 | Plaid Link iOS SDK, re-categorize | Planned |
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
