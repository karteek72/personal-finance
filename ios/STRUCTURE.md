# iOS Folder Structure

Target layout for the SpendFlow iPhone app. Update this doc when adding top-level folders.

```
ios/
├── README.md
├── STRUCTURE.md
├── project.yml                   # XcodeGen spec → SpendFlow.xcodeproj
├── Config/
│   ├── Debug.xcconfig
│   ├── Release.xcconfig
│   └── Local.xcconfig.example    # Copy to Local.xcconfig (gitignored)
├── SpendFlow/
│   ├── App/
│   │   ├── SpendFlowApp.swift    # @main entry, Google Sign-In bootstrap
│   │   ├── AppState.swift        # Auth + API client lifecycle
│   │   └── AppConfig.swift       # API base URL, Google client ID from Info.plist
│   ├── Features/
│   │   ├── Auth/
│   │   │   └── LoginView.swift
│   │   ├── Root/
│   │   │   └── MainTabView.swift
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
│   │   ├── SpendFlowColors.swift
│   │   ├── MoneyFormatter.swift
│   │   ├── MoneyText.swift
│   │   ├── KpiCard.swift
│   │   ├── AlertBanner.swift
│   │   └── SpendFlowCard.swift
│   ├── Services/
│   │   ├── APIClient.swift
│   │   ├── APIError.swift
│   │   ├── AuthService.swift
│   │   ├── KeychainService.swift
│   │   └── PlaidLinkCoordinator.swift   # Phase 2: native Plaid SDK
│   ├── Models/
│   │   └── API/
│   │       ├── Auth.swift
│   │       ├── Account.swift
│   │       ├── Transaction.swift
│   │       ├── Summary.swift
│   │       └── Alerts.swift
│   └── Resources/
│       ├── Info.plist
│       ├── SpendFlow.entitlements
│       └── Assets.xcassets/      # Primary, Surface, … from design-tokens.json
└── SpendFlowTests/
    └── Services/
        └── MoneyFormatterTests.swift
```

## Conventions

- **SwiftUI** for all screens; UIKit only if Plaid Link requires it (Phase 2)
- **MVVM-lite** — `@Observable` view models per feature; no massive view controllers
- **API models** — `Codable` structs matching `docs/design/api-contract.md` and `ui/src/types/api.ts`
- **Design tokens** — Asset Catalog colors from `docs/design/design-tokens.json`
- **Secrets** — API URL and Google client ID in xcconfig only; never commit Plaid secret

## Dependencies

- Google Sign-In iOS (Swift Package Manager, via XcodeGen)
- Plaid Link iOS SDK (Phase 2)
- URLSession for networking (no Alamofire)

## Generate Xcode project

```bash
cd ios && xcodegen generate && open SpendFlow.xcodeproj
```

`SpendFlow.xcodeproj` is gitignored; regenerate after `project.yml` changes.
