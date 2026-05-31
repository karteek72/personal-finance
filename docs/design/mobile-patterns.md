# Mobile Patterns (iOS)

**Product:** SpendFlow  
**Last Updated:** May 2026  
**Platform:** iPhone (SwiftUI) — primary; web mobile patterns in [ui-ux-specification.md](ui-ux-specification.md)

Shared visual tokens: [design-tokens.json](design-tokens.json)  
Architecture: [mobile-ios.md](../architecture/mobile-ios.md)

---

## Navigation

Web mobile (< 768px) and iPhone use the same five destinations from `design-tokens.json`:

| Tab | Icon (SF Symbol) | Screen |
|-----|------------------|--------|
| Dashboard | `chart.bar.fill` | KPIs, trends, alerts |
| Money Flow | `arrow.left.arrow.right` | Reconciliation view |
| Categories | `square.grid.2x2` | Breakdown + trends |
| Transactions | `list.bullet` | Search, filter, edit |
| Accounts | `building.columns` | Plaid connect, balances |

Use native `TabView` — do not embed web views for core flows.

---

## Authentication & session

| Pattern | Behavior |
|---------|----------|
| Login / register | Email + password → backend JWT pair |
| Access token | Memory only; attach as `Authorization: Bearer` |
| Refresh token | iOS Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`) |
| Token refresh | Silent refresh on 401; logout if refresh fails |
| Face ID / Touch ID | Optional local gate before showing balances (does not replace server auth) |
| Logout | Clear Keychain, unregister APNs via `DELETE /devices/:id` |

---

## Plaid Link (native)

- Present Plaid Link modally after fetching `linkToken` from backend
- Pass `platform: "ios"` in link-token request
- On success: send `publicToken` to backend immediately; show sync progress UI
- On exit / error: dismiss modal; show retry CTA
- **Never** persist Plaid access tokens on device

---

## Data loading

| Screen | Pattern |
|--------|---------|
| Dashboard | Fetch summary + alerts in parallel; skeleton placeholders |
| Transactions | Cursor pagination; infinite scroll |
| Categories | Single fetch for bar + table; cache 5 min |
| Accounts | Pull-to-refresh triggers `POST /plaid/items/:id/sync` |

Prefer network-first. Optional read-only cache for last-known dashboard (UserDefaults or encrypted Core Data) — clearly label stale data.

---

## Push notifications (Phase 4)

Register APNs token with `POST /devices` after login.

| Alert type | Push copy example |
|------------|-------------------|
| Overspend | "Dining is up 18% vs last month" |
| Plaid reconnect | "Chase Sapphire needs reconnection" |
| Sync complete | "Your accounts are up to date" |

Tap opens relevant screen (deep link: `spendflow://transactions?category=dining`).

---

## Visual mapping (SwiftUI)

| Design token | SwiftUI |
|--------------|---------|
| `color.primary.light/dark` | Asset Catalog `Primary` with light/dark variants |
| `typography.scale.moneyDefault` | `.font(.system(.body, design: .monospaced))` + `.monospacedDigit()` |
| `spacing.cardPaddingPx` | `.padding(16)` |
| `radius.cardPx` | `.cornerRadius(6)` |
| Category `chartColor` | `CategoryColor.from(id:)` enum generated from tokens JSON |
| Flat surfaces | No shadow; use `surface` fill + `border` stroke |

Support system light/dark mode via Asset Catalog — same strategy as web `prefers-color-scheme`.

---

## Accessibility

- Support Dynamic Type for body text; keep money rows readable at largest sizes
- VoiceOver labels on all KPI cards: "Total spent, three thousand ninety-nine dollars, up seven percent"
- Minimum touch target: 44×44 pt
- Sufficient contrast for danger/success on both themes (WCAG AA)

---

## App Store & privacy

- Privacy nutrition labels: financial info, identifiers, usage data (minimal)
- Link to privacy policy before Plaid Link
- App Tracking Transparency: not required if no cross-app tracking
- Export compliance: standard encryption (HTTPS) exemption typically applies

---

## Related documents

- [design-system.md](design-system.md)
- [design-tokens.json](design-tokens.json)
- [mobile-ios.md](../architecture/mobile-ios.md)
- [data-security-compliance.md](../architecture/data-security-compliance.md)
