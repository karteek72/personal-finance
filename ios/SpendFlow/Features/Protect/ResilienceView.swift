import SwiftUI

@MainActor
@Observable
final class ResilienceViewModel {
    var data: ResilienceResponse?
    var activeScenarioId: String?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getResilience()
            if activeScenarioId == nil {
                activeScenarioId = data?.scenarios.first?.id
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func scenarioScore(_ scenario: ResilienceResponse.Scenario) -> Double {
        guard scenario.recommendedMonths > 0 else { return 100 }
        return min(100, (scenario.monthsCovered / scenario.recommendedMonths) * 100)
    }
}

struct ResilienceView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = ResilienceViewModel()

    var body: some View {
        SpendFlowScreen(title: "Resilience", subtitle: "Emergency runway & stress tests") {
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
            LoadingStateView(message: "Stress-testing finances…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            runwayHero(data)
            scenarioSimulator(data)
            allScenariosOverview(data.scenarios)
        }
    }

    private func runwayHero(_ data: ResilienceResponse) -> some View {
        HeroGradientCard {
            HStack(alignment: .bottom, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Day-Zero runway")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.7))
                        .textCase(.uppercase)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(String(format: "%.1f", data.runwayMonths))
                            .font(.system(size: 44, weight: .heavy, design: .rounded).monospacedDigit())
                        Text("months")
                            .font(.title2.weight(.bold))
                    }
                    .foregroundStyle(.white)
                    Text("At burn of \(MoneyFormatter.format(data.monthlyBurn))/mo, your \(MoneyFormatter.format(data.liquidCash)) in liquid cash lasts about \(String(format: "%.1f", data.runwayMonths)) months if income stopped today.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                }
                VStack(spacing: 6) {
                    ScoreRingView(
                        score: data.immunityScore,
                        lineWidth: 8,
                        size: 96,
                        color: .white,
                        textColor: .white,
                        mutedTextColor: .white.opacity(0.75),
                        showLabel: false
                    )
                    Text("Immunity score")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.75))
                        .textCase(.uppercase)
                }
            }
        }
    }

    private func scenarioSimulator(_ data: ResilienceResponse) -> some View {
        let active = data.scenarios.first { $0.id == viewModel.activeScenarioId } ?? data.scenarios.first

        return SpendFlowCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("Stress-test your finances")
                    .font(.headline)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(data.scenarios) { scenario in
                            let score = viewModel.scenarioScore(scenario)
                            let isActive = scenario.id == viewModel.activeScenarioId
                            Button {
                                viewModel.activeScenarioId = scenario.id
                            } label: {
                                HStack(spacing: 6) {
                                    Text(scenario.emoji ?? "⚠️")
                                    Text(scenario.name)
                                    Circle()
                                        .fill(AnalyticsUI.scoreColor(score))
                                        .frame(width: 8, height: 8)
                                }
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(isActive ? SpendFlowTheme.primarySoft : SpendFlowTheme.surface, in: Capsule())
                                .overlay(Capsule().stroke(isActive ? SpendFlowTheme.primary : SpendFlowTheme.border))
                                .foregroundStyle(isActive ? SpendFlowTheme.primary : SpendFlowTheme.textMuted)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if let scenario = active {
                    scenarioDetail(scenario, liquidCash: data.liquidCash, monthlyBurn: data.monthlyBurn)
                }
            }
        }
    }

    private func scenarioDetail(
        _ scenario: ResilienceResponse.Scenario,
        liquidCash: String,
        monthlyBurn: String
    ) -> some View {
        let score = viewModel.scenarioScore(scenario)
        let shock = AnalyticsUI.parseAmount(scenario.shockAmount)
        let recurring = scenario.shockType != "one_time"

        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 16) {
                VStack(spacing: 4) {
                    ScoreRingView(
                        score: score,
                        size: 100,
                        color: AnalyticsUI.scoreColor(score),
                        showLabel: false
                    )
                    Text(AnalyticsUI.resilienceVerdict(score))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.textMuted)
                        .textCase(.uppercase)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(scenario.emoji ?? "⚠️") \(scenario.name)")
                        .font(.headline)
                    if let detail = scenario.detail {
                        Text(detail)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                }
            }

            VStack(spacing: 8) {
                detailRow(label: "Shock size", value: "\(MoneyFormatter.format(String(format: "%.0f", shock)))\(recurring ? "/mo" : "")")
                detailRow(label: "Liquid reserves", value: MoneyFormatter.format(liquidCash))
                detailRow(
                    label: "Survives for",
                    value: "\(String(format: "%.1f", scenario.monthsCovered)) months (target \(String(format: "%.0f", scenario.recommendedMonths)))"
                )
            }

            Text(scenarioAdvice(scenario: scenario, score: score, monthlyBurn: monthlyBurn))
                .font(.caption)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SpendFlowTheme.primarySoft.opacity(0.5), in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
        }
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(SpendFlowTheme.textMuted)
            Spacer()
            Text(value)
                .font(.caption.weight(.semibold))
                .monospacedDigit()
        }
    }

    private func scenarioAdvice(scenario: ResilienceResponse.Scenario, score: Double, monthlyBurn: String) -> String {
        if score >= 80 {
            return "You're well-prepared for this shock without touching investments or taking on debt."
        }
        let gap = max(0, scenario.recommendedMonths - scenario.monthsCovered)
        let burn = AnalyticsUI.parseAmount(monthlyBurn)
        let amount = MoneyFormatter.format(String(format: "%.0f", gap * burn))
        return "Building \(String(format: "%.1f", gap)) more months of expenses (\(amount)) into your emergency fund would close this gap."
    }

    private func allScenariosOverview(_ scenarios: [ResilienceResponse.Scenario]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Preparedness across all shocks")
                .font(.caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
                .textCase(.uppercase)

            ForEach(scenarios) { scenario in
                let score = viewModel.scenarioScore(scenario)
                SpendFlowCard {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("\(scenario.emoji ?? "⚠️") \(scenario.name)")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(AnalyticsUI.resilienceVerdict(score))
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(AnalyticsUI.scoreColor(score))
                        }
                        ProgressBarRow(label: "", value: score, color: AnalyticsUI.scoreColor(score))
                    }
                }
            }
        }
    }
}
