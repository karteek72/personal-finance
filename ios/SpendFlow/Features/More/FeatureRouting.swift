import SwiftUI

enum FeatureRouting {
    @ViewBuilder
    static func destinationView(for destination: FeatureDestination) -> some View {
        switch destination.id {
        case "wellness":
            WellnessView()
        case "dna":
            DnaView()
        case "patterns":
            PatternsView()
        case "behavioral":
            BehavioralView()
        case "merchants":
            MerchantsView()
        case "net-worth":
            NetWorthView()
        case "investments":
            InvestmentsView()
        case "fire":
            FireView()
        case "budgets":
            BudgetsView()
        case "recurring", "audits":
            RecurringView()
        case "calendar":
            CalendarView()
        case "forecast":
            ForecastView()
        case "resilience":
            ResilienceView()
        case "inflation":
            InflationView()
        case "debt":
            DebtView()
        case "family":
            FamilyView()
        case "profile":
            ProfileView()
        case "coach":
            CoachView()
        case "wrapped":
            WrappedView()
        case "import":
            StatementImportView()
        default:
            Text("Unknown feature: \(destination.title)")
                .foregroundStyle(SpendFlowTheme.textMuted)
        }
    }
}
