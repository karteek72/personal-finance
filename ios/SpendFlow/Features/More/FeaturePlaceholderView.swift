import SwiftUI

struct FeatureDestination: Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let subtitle: String
    let systemImage: String
}

enum FeatureHubSection: String, CaseIterable, Identifiable, Sendable {
    case understand
    case wealth
    case plan
    case protect
    case debt
    case family
    case profile
    case extras

    var id: String { rawValue }

    var title: String {
        switch self {
        case .understand: "Understand"
        case .wealth: "Wealth"
        case .plan: "Plan"
        case .protect: "Protect"
        case .debt: "Debt"
        case .family: "Family"
        case .profile: "Profile"
        case .extras: "More"
        }
    }

    var destinations: [FeatureDestination] {
        switch self {
        case .understand:
            return [
                .init(id: "wellness", title: "Wellness", subtitle: "Financial health score", systemImage: "heart.fill"),
                .init(id: "dna", title: "Spending DNA", subtitle: "Archetype & habits", systemImage: "sparkles"),
                .init(id: "patterns", title: "Patterns", subtitle: "Day-of-week & signals", systemImage: "waveform.path.ecg"),
                .init(id: "behavioral", title: "Behavioral", subtitle: "Streaks & challenges", systemImage: "flame.fill"),
                .init(id: "merchants", title: "Merchants", subtitle: "Top spend by merchant", systemImage: "bag.fill"),
            ]
        case .wealth:
            return [
                .init(id: "net-worth", title: "Net Worth", subtitle: "Assets & liabilities", systemImage: "chart.line.uptrend.xyaxis"),
                .init(id: "investments", title: "Investments", subtitle: "Holdings & allocation", systemImage: "chart.pie.fill"),
                .init(id: "fire", title: "FIRE", subtitle: "Retirement projection", systemImage: "sun.max.fill"),
            ]
        case .plan:
            return [
                .init(id: "budgets", title: "Budgets & Goals", subtitle: "Monthly plan", systemImage: "target"),
                .init(id: "recurring", title: "Recurring", subtitle: "Bills & subscriptions", systemImage: "arrow.triangle.2.circlepath"),
                .init(id: "calendar", title: "Calendar", subtitle: "Cashflow calendar", systemImage: "calendar"),
                .init(id: "forecast", title: "Forecast", subtitle: "Balance projection", systemImage: "cloud.sun.fill"),
                .init(id: "audits", title: "Cost Audits", subtitle: "Leaks & fees", systemImage: "magnifyingglass.circle"),
            ]
        case .protect:
            return [
                .init(id: "resilience", title: "Resilience", subtitle: "Emergency runway", systemImage: "shield.fill"),
                .init(id: "inflation", title: "Inflation", subtitle: "Personal CPI", systemImage: "chart.bar.doc.horizontal"),
            ]
        case .debt:
            return [
                .init(id: "debt", title: "Credit & Debt", subtitle: "Balances & APRs", systemImage: "creditcard.fill"),
            ]
        case .family:
            return [
                .init(id: "family", title: "Household", subtitle: "Members & accounts", systemImage: "person.3.fill"),
            ]
        case .profile:
            return [
                .init(id: "profile", title: "Profile", subtitle: "Age & assumptions", systemImage: "person.crop.circle"),
            ]
        case .extras:
            return [
                .init(id: "import", title: "Import Statements", subtitle: "QFX, CSV, PDF upload", systemImage: "doc.badge.arrow.up"),
                .init(id: "coach", title: "Coach", subtitle: "Guided insights", systemImage: "bubble.left.and.bubble.right.fill"),
                .init(id: "wrapped", title: "Wrapped", subtitle: "Year in review", systemImage: "gift.fill"),
            ]
        }
    }
}

struct MoreHubView: View {
    var body: some View {
        NavigationStack {
            List {
                ForEach(FeatureHubSection.allCases) { section in
                    Section(section.title) {
                        ForEach(section.destinations) { destination in
                            NavigationLink(value: destination) {
                                Label {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(destination.title)
                                            .font(.body.weight(.semibold))
                                        Text(destination.subtitle)
                                            .font(.caption)
                                            .foregroundStyle(SpendFlowTheme.textMuted)
                                    }
                                } icon: {
                                    Image(systemName: destination.systemImage)
                                        .foregroundStyle(SpendFlowTheme.primary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Explore")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    RecalculateButton()
                }
            }
            .navigationDestination(for: FeatureDestination.self) { destination in
                FeatureRouting.destinationView(for: destination)
            }
        }
    }
}
