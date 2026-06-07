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
        SpendFlowScreen(title: greetingTitle, subtitle: "Your money, minus the stress ✨") {
            content
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading, viewModel.summary == nil {
            LoadingStateView(message: "Loading your vibe check…")
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
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Net savings · \(Calendar.current.component(.year, from: Date()))")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                savingsChip(rate: summary.savingsRate)
            }

            MoneyText(
                amount: summary.netSavings,
                font: .system(size: 42, weight: .heavy, design: .rounded).monospacedDigit()
            )
            .foregroundStyle(.white)

            Text(vibeCopy(for: summary.netSavings))
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.9))

            HStack(spacing: 10) {
                miniStat(label: "Spent", amount: summary.totalSpent, emoji: "💸")
                miniStat(label: "Income", amount: summary.income, emoji: "💰")
                miniStat(label: "Avg/mo", amount: summary.avgMonthlySpend, emoji: "📊")
            }
        }
        .padding(22)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(SpendFlowTheme.heroGradient)
        }
        .shadow(color: SpendFlowTheme.primary.opacity(0.35), radius: 20, x: 0, y: 10)
    }

    private func savingsChip(rate: Double) -> some View {
        Text(String(format: "%.0f%% saved", max(0, rate * 100)))
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.white.opacity(0.22))
            .clipShape(Capsule())
            .foregroundStyle(.white)
    }

    private func miniStat(label: String, amount: String, emoji: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(emoji) \(label)")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white.opacity(0.8))
            MoneyText(amount: amount, font: .caption.weight(.bold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.white.opacity(0.16))
        .clipShape(RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM, style: .continuous))
    }

    @ViewBuilder
    private var alertsSection: some View {
        if !viewModel.alerts.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Heads up")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.text)
                ForEach(viewModel.alerts) { alert in
                    AlertBanner(alert: alert)
                }
            }
        }
    }

    private func quickStats(summary: TransactionSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick hits")
                .font(.headline.weight(.bold))
                .foregroundStyle(SpendFlowTheme.text)
            HStack(spacing: 12) {
                KpiCard(
                    label: "Top category",
                    value: summary.topCategory.amount,
                    subtext: summary.topCategory.name,
                    emoji: "🔥",
                    tone: .primary
                )
                KpiCard(
                    label: "CC excluded",
                    value: summary.ccPaymentsExcluded,
                    emoji: "💳",
                    tone: .neutral
                )
            }
        }
    }

    private var greetingTitle: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    private func vibeCopy(for netSavings: String) -> String {
        MoneyFormatter.isNonNegative(netSavings)
            ? "You're lowkey winning — keep the streak going 🔥"
            : "Spending's running hot — worth a quick peek 👀"
    }
}
