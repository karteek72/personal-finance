import SwiftUI

struct TransactionsDrilldownConfig: Identifiable, Sendable {
    let id = UUID()
    let title: String
    let subtitle: String?
    let filters: TransactionFilters
}

@MainActor
@Observable
final class TransactionsDrilldownViewModel {
    var transactions: [Transaction] = []
    var isLoading = false
    var isLoadingMore = false
    var errorMessage: String?
    private var nextCursor: String?

    func load(api: APIClient, filters: TransactionFilters, reset: Bool = true) async {
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

        var request = filters
        request.sort = .dateDesc
        request.limit = 50
        request.cursor = reset ? nil : nextCursor

        do {
            let response = try await api.getTransactions(filters: request)
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

    func loadMore(api: APIClient, filters: TransactionFilters) async {
        guard nextCursor != nil, !isLoadingMore else { return }
        await load(api: api, filters: filters, reset: false)
    }

    var canLoadMore: Bool { nextCursor != nil }
}

struct TransactionsDrilldownView: View {
    @Environment(AppState.self) private var appState
    let config: TransactionsDrilldownConfig

    @State private var viewModel = TransactionsDrilldownViewModel()

    var body: some View {
        List {
            if let subtitle = config.subtitle {
                Section {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
            }

            if viewModel.isLoading, viewModel.transactions.isEmpty {
                Section {
                    HStack {
                        Spacer()
                        ProgressView().tint(SpendFlowTheme.primary)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
            } else if let error = viewModel.errorMessage, viewModel.transactions.isEmpty {
                Section {
                    VStack(spacing: 12) {
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(SpendFlowTheme.danger)
                            .multilineTextAlignment(.center)
                        Button("Try again") {
                            Task { await reload() }
                        }
                        .font(.subheadline.weight(.semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
            } else if viewModel.transactions.isEmpty {
                Section {
                    Text("No matching transactions")
                        .font(.subheadline)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                }
            } else {
                Section {
                    ForEach(viewModel.transactions) { transaction in
                        TransactionRow(transaction: transaction)
                            .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    }

                    if viewModel.canLoadMore {
                        if viewModel.isLoadingMore {
                            HStack {
                                Spacer()
                                ProgressView().tint(SpendFlowTheme.primary)
                                Spacer()
                            }
                            .listRowBackground(Color.clear)
                        } else {
                            Button("Load more") {
                                Task {
                                    await viewModel.loadMore(
                                        api: appState.apiClient,
                                        filters: config.filters
                                    )
                                }
                            }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(SpendFlowTheme.primary)
                            .frame(maxWidth: .infinity)
                            .listRowBackground(Color.clear)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(SpendFlowTheme.background)
        .navigationTitle(config.title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: drilldownTaskID) {
            await reload()
        }
        .refreshable {
            await reload()
        }
    }

    private var drilldownTaskID: String {
        [
            config.filters.category ?? "",
            config.filters.accountId ?? "",
            config.filters.memberId ?? "",
            config.filters.type?.rawValue ?? "",
            config.filters.scope?.rawValue ?? "",
        ].joined(separator: "|")
    }

    private func reload() async {
        await viewModel.load(api: appState.apiClient, filters: config.filters)
    }
}
