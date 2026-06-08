import SwiftUI

@MainActor
@Observable
final class TimeMachineViewModel {
    var recurring: RecurringResponse?
    var investments: InvestmentsResponse?
    var selectedHabitIds: Set<String> = []
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let recurringTask = api.getRecurring()
            async let investmentsTask = api.getInvestments()
            recurring = try await recurringTask
            investments = try await investmentsTask

            if selectedHabitIds.isEmpty, let habits = recurring?.timeMachine?.habits {
                selectedHabitIds = Set(habits.prefix(2).map(\.id))
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleHabit(_ id: String) {
        if selectedHabitIds.contains(id) {
            selectedHabitIds.remove(id)
        } else {
            selectedHabitIds.insert(id)
        }
    }
}

struct TimeMachineView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = TimeMachineViewModel()

    var body: some View {
        SpendFlowScreen(title: "Time Machine", subtitle: "What if you'd invested instead?") {
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
        if viewModel.isLoading, viewModel.recurring == nil {
            LoadingStateView(message: "Rewinding time…")
        } else if let error = viewModel.errorMessage, viewModel.recurring == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else {
            brokerageHistory
            habitSelector
            spentVsInvested
            projectionChart
        }
    }

    @ViewBuilder
    private var brokerageHistory: some View {
        if let history = viewModel.investments?.investmentHistory {
            GlassCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your brokerage history")
                        .font(.headline)
                    Text(
                        "Over the last \(history.lookbackYears) years you deployed \(MoneyFormatter.format(history.totalContributed)) into investments (\(history.buyTransactionCount) buys)."
                    )
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    Text("Current portfolio: \(MoneyFormatter.format(history.currentPortfolioValue))")
                        .font(.caption.weight(.semibold))
                }
            }
        }
    }

    @ViewBuilder
    private var habitSelector: some View {
        guard let timeMachine = viewModel.recurring?.timeMachine, !timeMachine.habits.isEmpty else {
            FeatureEmptyCard(
                title: "No spending habits detected",
                message: "Connect accounts or import statements to power the time machine."
            )
            return
        }

        let chosen = timeMachine.habits.filter { viewModel.selectedHabitIds.contains($0.id) }
        let totalSpent = chosen.reduce(0.0) { $0 + AnalyticsUI.parseAmount($1.spent) }
        let totalInvested = chosen.reduce(0.0) { $0 + AnalyticsUI.parseAmount($1.investedValue) }
        let missedGain = totalInvested - totalSpent

        HeroGradientCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("If you'd invested instead…")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.7))
                Text(MoneyFormatter.format(String(format: "%.0f", totalInvested)))
                    .font(.system(size: 36, weight: .heavy))
                    .foregroundStyle(.white)
                Text(
                    "The \(MoneyFormatter.format(String(format: "%.0f", totalSpent))) spent on selected habits would be worth \(MoneyFormatter.format(String(format: "%.0f", totalInvested))) today — a hypothetical missed gain of \(MoneyFormatter.format(String(format: "%.0f", missedGain)))."
                )
                .font(.caption)
                .foregroundStyle(.white.opacity(0.85))
            }
        }

        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Pick habits to rewind")
                    .font(.headline)
                ForEach(timeMachine.habits) { habit in
                    let selected = viewModel.selectedHabitIds.contains(habit.id)
                    Button {
                        viewModel.toggleHabit(habit.id)
                    } label: {
                        HStack {
                            Text(habit.emoji ?? "💸")
                            VStack(alignment: .leading, spacing: 2) {
                                Text(habit.label).font(.subheadline.weight(.semibold))
                                Text("Spent \(MoneyFormatter.format(habit.spent)) over \(habit.yearsAgo) yrs")
                                    .font(.caption2)
                                    .foregroundStyle(SpendFlowTheme.textMuted)
                            }
                            Spacer()
                            Text("+\(MoneyFormatter.format(habit.investedValue))")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(SpendFlowTheme.success)
                        }
                        .padding(10)
                        .background(selected ? SpendFlowTheme.primarySoft : SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
                        .overlay(RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM).stroke(selected ? SpendFlowTheme.primary : SpendFlowTheme.border))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var spentVsInvested: some View {
        guard let timeMachine = viewModel.recurring?.timeMachine else { return }
        let chosen = timeMachine.habits.filter { viewModel.selectedHabitIds.contains($0.id) }
        let spent = chosen.reduce(0.0) { $0 + AnalyticsUI.parseAmount($1.spent) }
        let invested = chosen.reduce(0.0) { $0 + AnalyticsUI.parseAmount($1.investedValue) }
        let maxVal = max(spent, invested, 1)

        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Spent vs invested")
                    .font(.headline)
                progressRow(label: "Spent", value: spent, max: maxVal, color: SpendFlowTheme.danger)
                progressRow(label: "Would-be worth", value: invested, max: maxVal, color: SpendFlowTheme.success)
            }
        }
    }

    @ViewBuilder
    private var projectionChart: some View {
        guard let timeMachine = viewModel.recurring?.timeMachine else { return }
        let chosen = timeMachine.habits.filter { viewModel.selectedHabitIds.contains($0.id) }
        let invested = chosen.reduce(0.0) { $0 + AnalyticsUI.parseAmount($1.investedValue) }
        let future = invested * pow(1 + timeMachine.futureCompoundRate, Double(timeMachine.futureYears))

        let points = (0 ... timeMachine.futureYears).map { year in
            let value = invested * pow(1 + timeMachine.futureCompoundRate, Double(year))
            return ChartDataPoint(id: "\(year)", label: year == 0 ? "Now" : "\(year)y", value: value)
        }

        SpendFlowChartView(
            title: "\(timeMachine.futureYears)-year compound projection",
            points: points,
            style: .line,
            yAxisLabel: "Value",
            valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
        )

        Text("Projected \(MoneyFormatter.format(String(format: "%.0f", future))) at \(Int(timeMachine.futureCompoundRate * 100))% annual return (illustrative).")
            .font(.caption)
            .foregroundStyle(SpendFlowTheme.textMuted)
    }

    private func progressRow(label: String, value: Double, max: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label).font(.caption)
                Spacer()
                Text(MoneyFormatter.format(String(format: "%.0f", value)))
                    .font(.caption.weight(.semibold))
            }
            ProgressBarRow(label: "", value: value, maxValue: max, color: color)
        }
    }
}
