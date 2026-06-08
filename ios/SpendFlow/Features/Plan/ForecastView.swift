import SwiftUI

@MainActor
@Observable
final class ForecastViewModel {
    var data: ForecastResponse?
    var selectedDayIndex = 0
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getForecast()
            selectedDayIndex = 0
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ForecastView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = ForecastViewModel()

    var body: some View {
        SpendFlowScreen(title: "Forecast", subtitle: "Daily balance projection") {
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
            LoadingStateView(message: "Projecting cash flow…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data, !data.days.isEmpty {
            weatherHero(data: data)
            sevenDayStrip(data: data)
            summaryKpis(data: data)
            balanceChart(data: data)
            if let recommendation = data.recommendation.nilIfEmpty {
                recommendationBanner(recommendation, comfortFloor: data.comfortFloor)
            }
        }
    }

    private func weatherHero(data: ForecastResponse) -> some View {
        let day = data.days[safe: viewModel.selectedDayIndex] ?? data.days[0]
        return HeroGradientCard {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(day.weekday), \(day.date) · Financial outlook")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.65))
                    HStack(spacing: 10) {
                        Text(weatherIcon(day.weather)).font(.largeTitle)
                        Text(weatherLabel(day.weather))
                            .font(.title.weight(.heavy))
                            .foregroundStyle(.white)
                    }
                    Text(day.note)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(3)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Projected balance")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.65))
                    MoneyText(amount: day.projectedBalance, font: .title2.weight(.heavy))
                        .foregroundStyle(.white)
                }
            }
        }
    }

    private func sevenDayStrip(data: ForecastResponse) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("7-day forecast")
                    .font(.headline)
                HStack(spacing: 6) {
                    ForEach(Array(data.days.enumerated()), id: \.element.id) { index, day in
                        let selected = index == viewModel.selectedDayIndex
                        Button {
                            viewModel.selectedDayIndex = index
                        } label: {
                            VStack(spacing: 4) {
                                Text(day.weekday)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(SpendFlowTheme.textMuted)
                                Text(weatherIcon(day.weather))
                                Text(MoneyFormatter.format(day.projectedBalance))
                                    .font(.caption2.weight(.semibold))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.7)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(selected ? SpendFlowTheme.primarySoft : Color.clear, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
                            .overlay(
                                RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM)
                                    .stroke(selected ? SpendFlowTheme.primary : Color.clear, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func summaryKpis(data: ForecastResponse) -> some View {
        let stormyDays = data.days.filter { $0.weather == "stormy" || $0.weather == "cloudy" }.count
        return VStack(spacing: 12) {
            HStack(spacing: 12) {
                KpiCard(label: "Stormy/cloudy days", value: "\(stormyDays)", emoji: "⛈️", tone: .danger)
                KpiCard(label: "Min balance", value: data.minBalance, emoji: "📉", tone: .warning)
            }
            HStack(spacing: 12) {
                KpiCard(label: "Comfort floor", value: data.comfortFloor, emoji: "🛡️", tone: .neutral)
                KpiCard(label: "Next clear", value: data.nextClearDate, emoji: "☀️", tone: .success)
            }
        }
    }

    private func balanceChart(data: ForecastResponse) -> some View {
        SpendFlowChartView(
            title: "Balance projection",
            points: data.days.map {
                ChartDataPoint(
                    id: $0.date,
                    label: $0.weekday,
                    value: AnalyticsUI.parseAmount($0.projectedBalance)
                )
            },
            style: .line,
            yAxisLabel: "Balance",
            valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
        )
    }

    private func recommendationBanner(_ text: String, comfortFloor: String) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 6) {
                Label("Plan ahead for the dip", systemImage: "lightbulb.fill")
                    .font(.subheadline.weight(.semibold))
                Text(text).font(.caption).foregroundStyle(SpendFlowTheme.textMuted)
                Text("Comfort floor: \(MoneyFormatter.format(comfortFloor))")
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
        }
    }

    private func weatherIcon(_ weather: String) -> String {
        switch weather {
        case "sunny": "☀️"
        case "partly": "⛅"
        case "cloudy": "☁️"
        case "stormy": "⛈️"
        default: "☁️"
        }
    }

    private func weatherLabel(_ weather: String) -> String {
        switch weather {
        case "sunny": "Sunny"
        case "partly": "Partly cloudy"
        case "cloudy": "Cloudy"
        case "stormy": "Stormy"
        default: "Cloudy"
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
