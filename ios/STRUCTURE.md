# iOS Folder Structure (Planned)

Target layout for Phase 4 (iPhone). Do not create files outside this structure without updating this doc.

```
ios/
├── README.md
├── STRUCTURE.md
├── SpendFlow.xcodeproj
├── SpendFlow/
│   ├── App/
│   │   ├── SpendFlowApp.swift       # @main entry
│   │   └── AppState.swift           # Auth session, tab selection
│   ├── Features/
│   │   ├── Auth/
│   │   │   ├── LoginView.swift
│   │   │   └── RegisterView.swift
│   │   ├── Dashboard/
│   │   │   └── DashboardView.swift
│   │   ├── MoneyFlow/
│   │   │   └── MoneyFlowView.swift
│   │   ├── Categories/
│   │   │   └── CategoriesView.swift
│   │   ├── Transactions/
│   │   │   └── TransactionsView.swift
│   │   └── Accounts/
│   │       └── AccountsView.swift
│   ├── DesignSystem/
│   │   ├── Colors.xcassets          # From design-tokens.json
│   │   ├── CategoryColor.swift
│   │   ├── KpiCard.swift
│   │   ├── AlertBanner.swift
│   │   └── MoneyText.swift          # Monospaced tabular amounts
│   ├── Services/
│   │   ├── APIClient.swift          # Typed REST client
│   │   ├── AuthService.swift
│   │   ├── KeychainService.swift
│   │   ├── PlaidLinkCoordinator.swift
│   │   └── PushNotificationService.swift
│   ├── Models/
│   │   └── API/                     # Mirrors api-contract.md types
│   │       ├── Transaction.swift
│   │       ├── Account.swift
│   │       └── TransactionSummary.swift
│   └── Resources/
│       └── Info.plist
└── SpendFlowTests/
    └── Services/
        └── APIClientTests.swift
```

## Conventions

- **SwiftUI** for all screens; UIKit only for Plaid Link presentation if required
- **MVVM-lite** — Views + `@Observable` view models; no massive view controllers
- **API models** — `Codable` structs matching `api-contract.md` field names (camelCase in Swift via `JSONDecoder.keyDecodingStrategy`)
- **Design tokens** — regenerate Asset Catalog colors when `design-tokens.json` changes
- **Secrets** — API base URL in build settings only; never commit Plaid secret

## Dependencies (planned)

- Plaid Link iOS SDK (Swift Package Manager or CocoaPods)
- No third-party networking beyond `URLSession` unless needs grow
