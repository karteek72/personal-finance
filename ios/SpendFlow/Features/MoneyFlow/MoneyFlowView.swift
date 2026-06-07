import SwiftUI

@MainActor
@Observable
final class MoneyFlowViewModel {
    var flow: MoneyFlowResponse?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            flow = try await api.getMoneyFlow()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct MoneyFlowView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = MoneyFlowViewModel()

    var body: some View {
        SpendFlowScreen(title: "Flow", subtitle: "Income in, money out — the full picture") {
            if viewModel.isLoading, viewModel.flow == nil {
                LoadingStateView(message: "Mapping your flow…")
            } else if let error = viewModel.errorMessage, viewModel.flow == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else if let flow = viewModel.flow {
                flowColumn(
                    title: "Income",
                    emoji: "💰",
                    lines: flow.income.sources,
                    footerLabel: "Total in",
                    footerAmount: flow.income.total,
                    accent: SpendFlowTheme.success
                )
                flowColumn(
                    title: "Bank accounts",
                    emoji: "🏦",
                    lines: flow.bankAccounts.accounts,
                    footerLabel: "Transfers out",
                    footerAmount: flow.bankAccounts.transfersOut,
                    accent: SpendFlowTheme.primary
                )
                flowColumn(
                    title: "Credit cards",
                    emoji: "💳",
                    lines: flow.creditCards.accounts,
                    footerLabel: "Total charges",
                    footerAmount: flow.creditCards.totalCharges,
                    accent: SpendFlowTheme.accent
                )
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    private func flowColumn(
        title: String,
        emoji: String,
        lines: [FlowLine],
        footerLabel: String,
        footerAmount: String,
        accent: Color
    ) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Text(emoji).font(.title2)
                    Text(title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(SpendFlowTheme.text)
                }

                ForEach(lines) { line in
                    HStack {
                        Text(line.label)
                            .font(.subheadline)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                            .lineLimit(1)
                        Spacer()
                        MoneyText(amount: line.amount, font: .subheadline.weight(.semibold))
                    }
                }

                if lines.isEmpty {
                    Text("Nothing here yet")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }

                Divider().opacity(0.5)

                HStack {
                    Text(footerLabel)
                        .font(.subheadline.weight(.bold))
                    Spacer()
                    MoneyText(amount: footerAmount, font: .subheadline.weight(.bold))
                        .foregroundStyle(accent)
                }
            }
        }
    }
}
