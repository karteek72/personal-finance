import SwiftUI

@MainActor
@Observable
final class NetWorthViewModel {
    var data: NetWorthResponse?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getNetWorth()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct NetWorthView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = NetWorthViewModel()

    var body: some View {
        SpendFlowScreen(title: "Net Worth", subtitle: "Assets, debt, and the trend") {
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
        if viewModel.isLoading, viewModel.data == nil {
            LoadingStateView(message: "Calculating net worth…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            heroCard(data: data)
            breakdownSection(data: data)
            if !data.trend.isEmpty {
                trendChart(data: data)
            }
        }
    }

    private func heroCard(data: NetWorthResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Current net worth")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.85))

            MoneyText(
                amount: data.current.netWorth,
                font: .system(size: 40, weight: .heavy, design: .rounded).monospacedDigit()
            )
            .foregroundStyle(.white)

            HStack(spacing: 16) {
                miniStat(label: "Assets", amount: data.current.totalAssets)
                miniStat(label: "Debt", amount: data.current.totalLiabilities)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Accounts")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white.opacity(0.8))
                    Text("\(data.current.accountCount)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(22)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(SpendFlowTheme.heroGradient)
        }
        .shadow(color: SpendFlowTheme.primary.opacity(0.35), radius: 20, x: 0, y: 10)
    }

    private func miniStat(label: String, amount: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white.opacity(0.8))
            MoneyText(amount: amount, font: .caption.weight(.bold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func breakdownSection(data: NetWorthResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Breakdown")
                .font(.headline.weight(.bold))
                .foregroundStyle(SpendFlowTheme.text)

            breakdownRow(
                emoji: "🏦",
                label: "Cash & savings",
                total: data.breakdown.depository.total,
                count: data.breakdown.depository.accountCount,
                color: SpendFlowTheme.success
            )
            breakdownRow(
                emoji: "📈",
                label: "Investments",
                total: data.breakdown.investment.total,
                count: data.breakdown.investment.accountCount,
                color: SpendFlowTheme.primary
            )
            breakdownRow(
                emoji: "💳",
                label: "Credit cards",
                total: data.breakdown.credit.total,
                count: data.breakdown.credit.accountCount,
                color: SpendFlowTheme.danger
            )
        }
    }

    private func breakdownRow(emoji: String, label: String, total: String, count: Int, color: Color) -> some View {
        HStack(spacing: 14) {
            Text(emoji).font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.text)
                Text("\(count) account\(count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
            Spacer()
            MoneyText(amount: total, font: .subheadline.weight(.bold))
                .foregroundStyle(color)
        }
        .padding(14)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
    }

    private func trendChart(data: NetWorthResponse) -> some View {
        let points = data.trend.map { point in
            ChartDataPoint(
                id: point.month,
                label: monthLabel(point.month),
                value: parseAmount(point.netWorth)
            )
        }
        return SpendFlowChartView(
            title: "Net worth trend",
            points: points,
            style: .line,
            yAxisLabel: "Net worth",
            valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
        )
    }

    private func monthLabel(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let m = Int(parts[1]), m >= 1, m <= 12 else { return month }
        let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return names[m - 1]
    }

    private func parseAmount(_ amount: String) -> Double {
        guard let decimal = Decimal(string: amount) else { return 0 }
        return NSDecimalNumber(decimal: decimal).doubleValue
    }
}
