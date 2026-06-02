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
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if viewModel.isLoading, viewModel.flow == nil {
                        LoadingStateView(message: "Loading money flow…")
                    } else if let error = viewModel.errorMessage, viewModel.flow == nil {
                        ErrorStateView(message: error) {
                            Task { await viewModel.load(api: appState.apiClient) }
                        }
                    } else if let flow = viewModel.flow {
                        flowColumn(
                            title: "Income",
                            emoji: "💰",
                            lines: flow.income.sources,
                            footerLabel: "Total income",
                            footerAmount: flow.income.total
                        )
                        flowColumn(
                            title: "Bank accounts",
                            emoji: "🏦",
                            lines: flow.bankAccounts.accounts,
                            footerLabel: "Transfers out",
                            footerAmount: flow.bankAccounts.transfersOut
                        )
                        flowColumn(
                            title: "Credit cards",
                            emoji: "💳",
                            lines: flow.creditCards.accounts,
                            footerLabel: "Total charges",
                            footerAmount: flow.creditCards.totalCharges
                        )
                    }
                }
                .padding(20)
            }
            .background(SpendFlowColors.background)
            .navigationTitle("Money Flow")
            .refreshable {
                await viewModel.load(api: appState.apiClient)
            }
            .task {
                await viewModel.load(api: appState.apiClient)
            }
        }
    }

    private func flowColumn(
        title: String,
        emoji: String,
        lines: [FlowLine],
        footerLabel: String,
        footerAmount: String
    ) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Text(emoji)
                    Text(title)
                        .font(.headline)
                }

                ForEach(lines) { line in
                    HStack {
                        Text(line.label)
                            .font(.subheadline)
                            .foregroundStyle(SpendFlowColors.textMuted)
                            .lineLimit(1)
                        Spacer()
                        MoneyText(amount: line.amount, font: .subheadline)
                    }
                }

                Divider()

                HStack {
                    Text(footerLabel)
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    MoneyText(amount: footerAmount, font: .subheadline.weight(.bold))
                        .foregroundStyle(SpendFlowColors.primary)
                }
            }
        }
    }
}
