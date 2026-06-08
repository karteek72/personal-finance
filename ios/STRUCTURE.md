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
│   │   ├── SpendFlowApp.swift    # @main, deep links, Google Sign-In bootstrap
│   │   ├── AppState.swift        # Auth + API client + invite token lifecycle
│   │   ├── AppConfig.swift       # API base URL, Google client IDs
│   │   ├── AppDelegate.swift     # Push notification registration
│   │   └── AnalyticsDateRange.swift
│   ├── Features/
│   │   ├── Auth/
│   │   │   ├── LoginView.swift
│   │   │   └── AppLockView.swift
│   │   ├── Root/
│   │   │   └── MainTabView.swift # 6-tab shell + bell + settings menu
│   │   ├── Dashboard/
│   │   │   └── DashboardView.swift
│   │   ├── MoneyFlow/
│   │   │   └── MoneyFlowView.swift
│   │   ├── Categories/
│   │   │   └── CategoriesView.swift
│   │   ├── Transactions/
│   │   │   └── TransactionsView.swift
│   │   ├── Accounts/
│   │   │   └── AccountsView.swift
│   │   ├── Import/
│   │   │   └── StatementImportView.swift
│   │   ├── Understand/
│   │   │   ├── WellnessView.swift
│   │   │   ├── DnaView.swift
│   │   │   ├── PatternsView.swift
│   │   │   ├── BehavioralView.swift
│   │   │   └── MerchantsView.swift
│   │   ├── Wealth/
│   │   │   ├── NetWorthView.swift
│   │   │   ├── InvestmentsView.swift
│   │   │   ├── TimeMachineView.swift
│   │   │   └── FireView.swift
│   │   ├── Plan/
│   │   │   ├── BudgetsView.swift
│   │   │   ├── RecurringView.swift
│   │   │   ├── CalendarView.swift
│   │   │   └── ForecastView.swift
│   │   ├── Protect/
│   │   │   ├── ResilienceView.swift
│   │   │   └── InflationView.swift
│   │   ├── Debt/
│   │   │   └── DebtView.swift
│   │   ├── Family/
│   │   │   ├── FamilyView.swift
│   │   │   └── AcceptInviteView.swift
│   │   ├── Profile/
│   │   │   └── ProfileView.swift
│   │   ├── Settings/
│   │   │   └── SettingsView.swift
│   │   ├── Extras/
│   │   │   ├── CoachView.swift
│   │   │   └── WrappedView.swift
│   │   └── More/
│   │       ├── FeaturePlaceholderView.swift  # Explore hub + FeatureDestination
│   │       └── FeatureRouting.swift
│   ├── DesignSystem/
│   │   ├── SpendFlowColors.swift
│   │   ├── SpendFlowCard.swift       # GlassCard, SpendFlowScreen, tab bar
│   │   ├── SpendFlowChartView.swift
│   │   ├── MoneyFormatter.swift
│   │   ├── MoneyText.swift
│   │   ├── KpiCard.swift
│   │   ├── AlertBanner.swift
│   │   ├── PaginatedListView.swift
│   │   ├── RecalculateButton.swift
│   │   ├── MetricEnvelopeView.swift  # MetricLiveBadge + confidence/caveats
│   │   ├── NotificationCenterView.swift
│   │   └── AnalyticsUIHelpers.swift
│   ├── Services/
│   │   ├── APIClient.swift
│   │   ├── APIClient+Features.swift
│   │   ├── APIClient+Connections.swift   # Plaid/Teller sync, export
│   │   ├── APIClient+Imports.swift
│   │   ├── APIClient+Household.swift
│   │   ├── APIClient+Snaptrade.swift
│   │   ├── APIError.swift
│   │   ├── AuthService.swift
│   │   ├── KeychainService.swift
│   │   ├── AppLockService.swift
│   │   ├── FinancialRefreshCenter.swift
│   │   ├── PushNotificationService.swift
│   │   ├── PlaidLinkCoordinator.swift
│   │   └── SnapTradeLinkCoordinator.swift
│   ├── Models/
│   │   └── API/                      # Codable types mirroring api-contract.md
│   └── Resources/
│       ├── Info.plist
│       ├── SpendFlow.entitlements
│       └── Assets.xcassets/
└── SpendFlowTests/
    └── Services/
        └── MoneyFormatterTests.swift
```

## Navigation

| Layer | Count | Items |
|-------|-------|-------|
| **Tabs** | 6 | Home, Flow, Spend, Activity, Wallet, More (Explore hub) |
| **Explore screens** | 25 | See hub sections below |

### Explore hub sections

| Section | Screens |
|---------|---------|
| Understand | Wellness, Spending DNA, Patterns, Behavioral, Merchants |
| Wealth | Net Worth, Investments, Time Machine, FIRE |
| Plan | Budgets & Goals, Recurring, Calendar, Forecast, Cost Audits |
| Protect | Resilience, Inflation |
| Debt | Credit & Debt |
| Family | Household (+ Accept Invite deep link) |
| Profile | Profile |
| More | Statement Import, Coach, Wrapped |

Global chrome: notification bell (`GET /insights/alerts`), recalculate button, settings sheet (profile, notifications, Face ID, GDPR export, legal links).

## Conventions

- **SwiftUI** for all screens; LinkKit for Plaid Link; SnapTrade portal for brokerages
- **MVVM-lite** — `@Observable` view models per feature
- **API models** — `Codable` structs matching `docs/design/api-contract.md`
- **Design tokens** — Asset Catalog colors from `docs/design/design-tokens.json`
- **Secrets** — API URL and Google client ID in xcconfig only

## Dependencies

- Google Sign-In iOS (Swift Package Manager)
- Plaid LinkKit 6.3+ (`plaid-link-ios-spm`)
- URLSession for networking

## Generate Xcode project

```bash
cd ios && xcodegen generate && open SpendFlow.xcodeproj
```

`SpendFlow.xcodeproj` is gitignored; regenerate after `project.yml` changes.
