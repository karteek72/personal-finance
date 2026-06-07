import SwiftUI

@MainActor
@Observable
final class ForecastViewModel {
    var data: ForecastResponse?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getForecast()
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
        } else if let data = viewModel.data {
            summaryCards(data: data)
            if let recommendation = data.recommendation.nilIfEmpty {
                recommendationBanner(recommendation)
            }
            dailyList(data: data)
        }
    }

    private func summaryCards(data: ForecastResponse) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                KpiCard(label: "Comfort floor", value: data.comfortFloor, emoji: "🛡️", tone: .neutral)
                KpiCard(label: "Min balance", value: data.minBalance, emoji: "📉", tone: .danger)
            }
            HStack(spacing: 12) {
                KpiCard(label: "Lowest day", value: data.lowestDay, emoji: "⛈️", tone: .primary)
                KpiCard(label: "Next clear", value: data.nextClearDate, emoji: "☀️", tone: .success)
            }
        }
    }

    private func recommendationBanner(_ text: String) -> some View {
        GlassCard {
            Label(text, systemImage: "lightbulb.fill")
                .font(.subheadline)
                .foregroundStyle(SpendFlowTheme.text)
        }
    }

    private func dailyList(data: ForecastResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Daily projection")
                .font(.headline.weight(.bold))

            ForEach(data.days) { day in
                forecastRow(day)
            }
        }
    }

    private func forecastRow(_ day: ForecastResponse.Day) -> some View {
        HStack(spacing: 12) {
            VStack(spacing: 2) {
                Text(weatherIcon(day.weather))
                    .font(.title3)
                Text(day.weekday)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
            .frame(width: 44)

            VStack(alignment: .leading, spacing: 4) {
                Text(day.date)
                    .font(.subheadline.weight(.semibold))
                Text(day.note)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .lineLimit(2)
            }

            Spacer()

            MoneyText(amount: day.projectedBalance, font: .subheadline.weight(.bold))
                .foregroundStyle(balanceColor(day.weather))
        }
        .padding(14)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
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

    private func balanceColor(_ weather: String) -> Color {
        switch weather {
        case "sunny", "partly": SpendFlowTheme.success
        case "stormy": SpendFlowTheme.danger
        default: SpendFlowTheme.text
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
