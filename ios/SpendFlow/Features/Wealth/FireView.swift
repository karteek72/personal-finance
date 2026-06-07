import SwiftUI

@MainActor
@Observable
final class FireViewModel {
    var data: FireResponse?
    var withdrawalRate: Double = 4
    var realReturn: Double = 4.5
    var draftAge: String = ""
    var isLoading = false
    var isSaving = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let overrides = FireQueryOverrides(
                withdrawalRate: withdrawalRate,
                realReturn: realReturn
            )
            data = try await api.getFire(overrides: overrides)
            if let data {
                withdrawalRate = data.withdrawalRate
                realReturn = data.realReturn
                if draftAge.isEmpty {
                    draftAge = String(data.currentAge)
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func patchAssumptions(api: APIClient) async {
        isSaving = true
        defer { isSaving = false }

        do {
            let patch = FireProfilePatch(
                withdrawalRate: withdrawalRate,
                realReturn: realReturn
            )
            data = try await api.patchFire(patch)
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveAge(api: APIClient) async {
        guard let age = Int(draftAge), age >= 18, age <= 100 else {
            errorMessage = "Enter an age between 18 and 100."
            return
        }
        isSaving = true
        defer { isSaving = false }

        do {
            data = try await api.patchFire(FireProfilePatch(currentAge: age))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct FireView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = FireViewModel()

    var body: some View {
        @Bindable var bindableModel = viewModel
        SpendFlowScreen(title: "FIRE", subtitle: "Retirement projection from the server") {
            if bindableModel.isLoading, bindableModel.data == nil {
                LoadingStateView(message: "Projecting FIRE path…")
            } else if let error = bindableModel.errorMessage, bindableModel.data == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else if let data = bindableModel.data {
                if data.isDefaultAge {
                    agePrompt(draftAge: $bindableModel.draftAge)
                }
                projectionHero(data: data)
                assumptionsCard(
                    data: data,
                    withdrawalRate: $bindableModel.withdrawalRate,
                    realReturn: $bindableModel.realReturn
                )
                if !data.projection.curve.isEmpty {
                    curveChart(data: data)
                }
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    private func agePrompt(draftAge: Binding<String>) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("Age is unset", systemImage: "exclamationmark.triangle.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.warning)

                Text("Set your age to see your projected FIRE age. Years-to-FIRE still uses your spending and investing inputs.")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)

                HStack(spacing: 10) {
                    TextField("Age", text: draftAge)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    Button("Save") {
                        Task { await viewModel.saveAge(api: appState.apiClient) }
                    }
                    .font(.caption.weight(.bold))
                    .disabled(viewModel.isSaving)
                }
            }
        }
    }

    private func projectionHero(data: FireResponse) -> some View {
        let projection = data.projection
        return VStack(alignment: .leading, spacing: 14) {
            Text("FIRE projection")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.85))

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Age")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                Text("\(projection.fireAge)")
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }

            MoneyText(
                amount: projection.fireNumber,
                font: .title2.weight(.bold)
            )
            .foregroundStyle(.white)

            HStack(spacing: 16) {
                statPill(label: "Years to FIRE", value: "\(projection.yearsToFire)")
                statPill(label: "Investing rate", value: String(format: "%.0f%%", projection.investingRate))
                statPill(label: "Net worth", value: MoneyFormatter.format(data.currentNetWorth))
            }
        }
        .padding(22)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(SpendFlowTheme.heroGradient)
        }
    }

    private func statPill(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.white.opacity(0.75))
            Text(value)
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func assumptionsCard(
        data: FireResponse,
        withdrawalRate: Binding<Double>,
        realReturn: Binding<Double>
    ) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Assumptions")
                    .font(.headline.weight(.bold))

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Real return")
                        Spacer()
                        Text(String(format: "%.1f%%", realReturn.wrappedValue))
                            .font(.caption.weight(.bold))
                    }
                    Slider(value: realReturn, in: 1...10, step: 0.5)
                        .tint(SpendFlowTheme.primary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Withdrawal rate")
                        Spacer()
                        Text(String(format: "%.1f%%", withdrawalRate.wrappedValue))
                            .font(.caption.weight(.bold))
                    }
                    Slider(value: withdrawalRate, in: 2...6, step: 0.25)
                        .tint(SpendFlowTheme.primary)
                }

                SpendFlowPrimaryButton(title: "Update assumptions", isLoading: viewModel.isSaving) {
                    Task { await viewModel.patchAssumptions(api: appState.apiClient) }
                }

                if let assumptions = data.assumptions, assumptions.inflationHandledViaRealReturn {
                    Text("All figures are in today's dollars — inflation is handled via real return.")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }

                if let caveats = data.caveats {
                    ForEach(caveats, id: \.self) { caveat in
                        Label(caveat, systemImage: "info.circle")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.warning)
                    }
                }
            }
        }
    }

    private func curveChart(data: FireResponse) -> some View {
        let points = data.projection.curve.enumerated().map { index, value in
            ChartDataPoint(
                id: String(index),
                label: "+\(index)y",
                value: value
            )
        }
        return SpendFlowChartView(
            title: "Wealth curve",
            points: points,
            style: .line,
            yAxisLabel: "Balance",
            valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
        )
    }
}
