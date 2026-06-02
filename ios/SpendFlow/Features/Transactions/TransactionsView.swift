import SwiftUI

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
        case all
        case expense
        case income
        case transfer

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

    var canLoadMore: Bool {
        nextCursor != nil
    }
}

struct TransactionsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = TransactionsViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Filter", selection: $viewModel.filter) {
                    ForEach(TransactionsViewModel.TransactionTypeFilter.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .onChange(of: viewModel.filter) { _, _ in
                    Task { await viewModel.load(api: appState.apiClient) }
                }

                Group {
                    if viewModel.isLoading, viewModel.transactions.isEmpty {
                        LoadingStateView(message: "Loading transactions…")
                    } else if let error = viewModel.errorMessage, viewModel.transactions.isEmpty {
                        ErrorStateView(message: error) {
                            Task { await viewModel.load(api: appState.apiClient) }
                        }
                    } else {
                        List {
                            ForEach(viewModel.transactions) { transaction in
                                TransactionRow(transaction: transaction)
                                    .listRowBackground(SpendFlowColors.surface)
                            }

                            if viewModel.canLoadMore {
                                HStack {
                                    Spacer()
                                    if viewModel.isLoadingMore {
                                        ProgressView()
                                    } else {
                                        Button("Load more") {
                                            Task {
                                                await viewModel.loadMore(api: appState.apiClient)
                                            }
                                        }
                                    }
                                    Spacer()
                                }
                                .listRowBackground(Color.clear)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .background(SpendFlowColors.background)
            .navigationTitle("Transactions")
            .refreshable {
                await viewModel.load(api: appState.apiClient)
            }
            .task {
                await viewModel.load(api: appState.apiClient)
            }
        }
    }
}

struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(CategoryColor.forCategory(transaction.category))
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.merchantName ?? transaction.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("\(transaction.category) · \(transaction.date)")
                    .font(.caption)
                    .foregroundStyle(SpendFlowColors.textMuted)
            }

            Spacer()

            MoneyText(
                amount: transaction.amount,
                currencyCode: transaction.currencyCode,
                font: .subheadline.weight(.semibold)
            )
            .foregroundStyle(amountColor)
        }
        .accessibilityElement(children: .combine)
    }

    private var amountColor: Color {
        switch transaction.transactionType {
        case .income: SpendFlowColors.success
        case .expense: SpendFlowColors.danger
        case .transfer: SpendFlowColors.primary
        }
    }
}
