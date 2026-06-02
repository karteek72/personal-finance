import SwiftUI

@MainActor
@Observable
final class DashboardViewModel {
    var summary: TransactionSummary?
    var alerts: [Alert] = []
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let year = Calendar.current.component(.year, from: Date())
        let from = "\(year)-01-01"
        let to = "\(year)-12-31"

        do {
            async let summaryTask = api.getSummary(from: from, to: to)
            async let alertsTask = api.getAlerts()
            summary = try await summaryTask
            alerts = try await alertsTask.alerts
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DashboardViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    content
                }
                .padding(20)
            }
            .background(SpendFlowColors.background)
            .navigationTitle("Dashboard")
            .refreshable {
                await viewModel.load(api: appState.apiClient)
            }
            .task {
                await viewModel.load(api: appState.apiClient)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading, viewModel.summary == nil {
            LoadingStateView(message: "Loading dashboard…")
        } else if let error = viewModel.errorMessage, viewModel.summary == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let summary = viewModel.summary {
            heroCard(summary: summary)
            alertsSection
            quickStats(summary: summary)
        }
    }

    private func heroCard(summary: TransactionSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(greeting)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.9))

            Text("Your net savings this year")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.8))

            MoneyText(
                amount: summary.netSavings,
                font: .system(size: 36, weight: .heavy, design: .rounded).monospacedDigit()
            )
            .foregroundStyle(.white)

            Text(MoneyFormatter.isNonNegative(summary.netSavings)
                ? "You're in the green — keep it up"
                : "Spending's ahead of income — worth a look")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.85))

            HStack(spacing: 8) {
                miniStat(label: "Spent", amount: summary.totalSpent)
                miniStat(label: "Income", amount: summary.income)
                miniStat(label: "Avg / mo", amount: summary.avgMonthlySpend)
            }
            .padding(.top, 8)
        }
        .padding(20)
        .background(SpendFlowColors.heroGradient)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private func miniStat(label: String, amount: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.white.opacity(0.75))
            MoneyText(amount: amount, font: .caption.weight(.bold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(.white.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }

    @ViewBuilder
    private var alertsSection: some View {
        if !viewModel.alerts.isEmpty {
            VStack(spacing: 8) {
                ForEach(viewModel.alerts) { alert in
                    AlertBanner(alert: alert)
                }
            }
        }
    }

    private func quickStats(summary: TransactionSummary) -> some View {
        HStack(spacing: 12) {
            KpiCard(
                label: "Top category",
                value: summary.topCategory.amount,
                subtext: summary.topCategory.name,
                tone: .primary
            )
            KpiCard(
                label: "CC payments excluded",
                value: summary.ccPaymentsExcluded,
                tone: .neutral
            )
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning 👋" }
        if hour < 17 { return "Good afternoon 👋" }
        return "Good evening 👋"
    }
}
