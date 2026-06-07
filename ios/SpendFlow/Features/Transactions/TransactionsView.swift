import SwiftUI

struct TransactionsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = TransactionsViewModel()

    var body: some View {
        SpendFlowScreen(title: "Activity", subtitle: "Every swipe, every subscription 👀") {
            PillFilterBar(
                items: TransactionsViewModel.TransactionTypeFilter.allCases,
                selection: $viewModel.filter,
                label: \.label,
                emoji: { filter in
                    switch filter {
                    case .all: "✨"
                    case .expense: "💸"
                    case .income: "💰"
                    case .transfer: "↔️"
                    }
                }
            )
            .onChange(of: viewModel.filter) { _, _ in
                Task { await viewModel.load(api: appState.apiClient) }
            }

            if viewModel.isLoading, viewModel.transactions.isEmpty {
                LoadingStateView(message: "Fetching transactions…")
            } else if let error = viewModel.errorMessage, viewModel.transactions.isEmpty {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(viewModel.transactions) { transaction in
                        TransactionRow(transaction: transaction)
                    }

                    if viewModel.canLoadMore {
                        if viewModel.isLoadingMore {
                            ProgressView().tint(SpendFlowTheme.primary)
                        } else {
                            Button("Load more") {
                                Task { await viewModel.loadMore(api: appState.apiClient) }
                            }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(SpendFlowTheme.primary)
                        }
                    }
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
}

struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 14) {
            CategoryChip(color: CategoryColor.forCategory(transaction.category))

            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.merchantName ?? transaction.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.text)
                    .lineLimit(1)
                Text("\(transaction.category) · \(formattedDate)")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }

            Spacer(minLength: 8)

            MoneyText(
                amount: transaction.amount,
                currencyCode: transaction.currencyCode,
                font: .subheadline.weight(.bold)
            )
            .foregroundStyle(amountColor)
        }
        .padding(14)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .fill(SpendFlowTheme.surface)
        }
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
    }

    private var formattedDate: String {
        let parts = transaction.date.split(separator: "-")
        guard parts.count == 3 else { return transaction.date }
        return "\(parts[1])/\(parts[2])"
    }

    private var amountColor: Color {
        switch transaction.transactionType {
        case .income: SpendFlowTheme.success
        case .expense: SpendFlowTheme.danger
        case .transfer: SpendFlowTheme.primary
        }
    }
}

@MainActor
@Observable
final class TransactionsViewModel {
    var transactions: [Transaction] = []
    var isLoading = false
    var isLoadingMore = false
    var errorMessage: String?
    var filter: TransactionTypeFilter = .all
    private var nextCursor: String?

    enum TransactionTypeFilter: String, CaseIterable, Identifiable {
        case all, expense, income, transfer

        var id: String { rawValue }

        var label: String {
            switch self {
            case .all: "All"
            case .expense: "Spent"
            case .income: "In"
            case .transfer: "Moves"
            }
        }

        var transactionType: TransactionType? {
            switch self {
            case .all: nil
            case .expense: .expense
            case .income: .income
            case .transfer: .transfer
            }
        }
    }

    func load(api: APIClient, reset: Bool = true) async {
        if reset {
            isLoading = true
            nextCursor = nil
            transactions = []
        } else {
            isLoadingMore = true
        }
        errorMessage = nil
        defer {
            isLoading = false
            isLoadingMore = false
        }

        var filters = TransactionFilters()
        filters.type = filter.transactionType
        filters.sort = .dateDesc
        filters.limit = 50
        filters.cursor = reset ? nil : nextCursor

        do {
            let response = try await api.getTransactions(filters: filters)
            if reset {
                transactions = response.items
            } else {
                transactions.append(contentsOf: response.items)
            }
            nextCursor = response.nextCursor
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadMore(api: APIClient) async {
        guard nextCursor != nil, !isLoadingMore else { return }
        await load(api: api, reset: false)
    }

    var canLoadMore: Bool { nextCursor != nil }
}
