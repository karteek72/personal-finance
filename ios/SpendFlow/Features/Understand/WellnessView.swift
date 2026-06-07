import SwiftUI

@MainActor
@Observable
final class WellnessViewModel {
    var data: WellnessResponse?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getWellness()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct WellnessView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = WellnessViewModel()

    var body: some View {
        SpendFlowScreen(title: "Wellness", subtitle: "Your financial health score") {
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
            LoadingStateView(message: "Calculating wellness…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            if data.dimensions.isEmpty, data.history.isEmpty {
                FeatureEmptyCard(
                    title: "Not enough data yet",
                    message: "Link accounts and sync transactions to build your wellness score."
                )
            } else {
                scoreHero(data)
                if !data.history.isEmpty {
                    historyChart(data)
                }
                if !data.dimensions.isEmpty {
                    dimensionsSection(data.dimensions)
                }
            }
        }
    }

    private func scoreHero(_ data: WellnessResponse) -> some View {
        SpendFlowCard {
            HStack(spacing: 20) {
                ScoreRingView(score: data.score)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Financial wellness score")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.textMuted)
                    Text("\(data.delta >= 0 ? "+" : "")\(Int(data.delta.rounded())) pts vs last month")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(SpendFlowTheme.text)
                    Text("Composite of savings, debt, emergency fund, cash flow, inflation beat, investments, and goals.")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
            }
        }
    }

    private func historyChart(_ data: WellnessResponse) -> some View {
        SpendFlowChartView(
            title: "Score history",
            points: data.history.map {
                ChartDataPoint(
                    id: $0.month,
                    label: AnalyticsUI.shortMonth($0.month),
                    value: $0.score
                )
            },
            style: .bar,
            yAxisLabel: "Score",
            valueFormatter: { String(format: "%.0f", $0) }
        )
    }

    private func dimensionsSection(_ dimensions: [WellnessResponse.Dimension]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Score breakdown")
                .font(.caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
                .textCase(.uppercase)

            ForEach(dimensions) { dimension in
                SpendFlowCard {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(dimension.name)
                                    .font(.subheadline.weight(.semibold))
                                Text(dimension.description)
                                    .font(.caption)
                                    .foregroundStyle(SpendFlowTheme.textMuted)
                            }
                            Spacer()
                            HStack(spacing: 4) {
                                trendIcon(dimension.trend)
                                Text("\(Int(dimension.score.rounded()))")
                                    .font(.title3.weight(.bold).monospacedDigit())
                                    .foregroundStyle(AnalyticsUI.scoreColor(dimension.score))
                            }
                        }
                        ProgressBarRow(
                            label: "",
                            value: dimension.score,
                            color: AnalyticsUI.scoreColor(dimension.score)
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func trendIcon(_ trend: String) -> some View {
        switch trend {
        case "up":
            Image(systemName: "arrow.up.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.success)
        case "down":
            Image(systemName: "arrow.down.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.danger)
        default:
            Image(systemName: "minus")
                .font(.caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
        }
    }
}
