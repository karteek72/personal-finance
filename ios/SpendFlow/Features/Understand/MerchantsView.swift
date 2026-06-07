import SwiftUI

@MainActor
@Observable
final class MerchantsViewModel {
    var rows: [MerchantRow] = []
    var summary: MerchantsSummary?
    var page = 1
    var totalPages = 1
    var query = ListQuery(page: 1, pageSize: 10, sort: "total", dir: .desc)
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.getMerchantsTable(query: query)
            rows = response.rows
            summary = response.summary
            page = response.page
            totalPages = response.totalPages
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func search(_ text: String) {
        query.q = text.isEmpty ? nil : text
        query.page = 1
    }

    func setSort(_ sort: String) {
        if query.sort == sort {
            query.dir = query.dir == .desc ? .asc : .desc
        } else {
            query.sort = sort
            query.dir = .desc
        }
        query.page = 1
    }

    func nextPage() {
        guard page < totalPages else { return }
        query.page = page + 1
    }

    func previousPage() {
        guard page > 1 else { return }
        query.page = page - 1
    }
}

struct MerchantsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = MerchantsViewModel()

    var body: some View {
        SpendFlowScreen(title: "Merchants", subtitle: "Top spend by merchant") {
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
        if viewModel.isLoading, viewModel.rows.isEmpty, viewModel.summary == nil {
            LoadingStateView(message: "Loading merchants…")
        } else if let error = viewModel.errorMessage, viewModel.rows.isEmpty {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else {
            if let summary = viewModel.summary {
                summaryGrid(summary)
            }
            sortBar
            merchantsList
        }
    }

    private func summaryGrid(_ summary: MerchantsSummary) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                KpiCard(
                    label: "Top merchant",
                    value: summary.topMerchant?.total ?? "—",
                    subtext: summary.topMerchant?.name,
                    emoji: "🏆",
                    tone: .primary
                )
                KpiCard(
                    label: "Most visited",
                    value: summary.mostVisited.map { "\($0.visits)" } ?? "—",
                    subtext: summary.mostVisited?.name,
                    emoji: "📍",
                    tone: .neutral
                )
            }
            HStack(spacing: 12) {
                KpiCard(
                    label: "Fastest growing",
                    value: summary.fastestGrowing.map { String(format: "%+.0f%%", $0.trend) } ?? "—",
                    subtext: summary.fastestGrowing?.name,
                    emoji: "📈",
                    tone: .danger
                )
                KpiCard(
                    label: "Merchants tracked",
                    value: "\(summary.merchantCount)",
                    subtext: summary.totalSpend,
                    emoji: "🛍️",
                    tone: .neutral
                )
            }
        }
    }

    private var sortBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(["total", "visits", "trend"], id: \.self) { sort in
                    let selected = viewModel.query.sort == sort
                    Button {
                        viewModel.setSort(sort)
                        Task { await viewModel.load(api: appState.apiClient) }
                    } label: {
                        Text(sortLabel(sort))
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(selected ? SpendFlowTheme.primary : SpendFlowTheme.surface, in: Capsule())
                            .foregroundStyle(selected ? .white : SpendFlowTheme.textMuted)
                            .overlay(Capsule().stroke(selected ? Color.clear : SpendFlowTheme.border))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func sortLabel(_ sort: String) -> String {
        switch sort {
        case "total": "Total spend"
        case "visits": "Visits"
        case "trend": "Trend"
        default: sort.capitalized
        }
    }

    private var merchantsList: some View {
        PaginatedListView(
            title: "Merchant analytics",
            query: Binding(
                get: { viewModel.query },
                set: { viewModel.query = $0 }
            ),
            rows: viewModel.rows,
            page: viewModel.page,
            totalPages: viewModel.totalPages,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            onReload: { Task { await viewModel.load(api: appState.apiClient) } },
            onNextPage: {
                viewModel.nextPage()
                Task { await viewModel.load(api: appState.apiClient) }
            },
            onPreviousPage: {
                viewModel.previousPage()
                Task { await viewModel.load(api: appState.apiClient) }
            },
            onSearch: { text in
                viewModel.search(text)
                Task { await viewModel.load(api: appState.apiClient) }
            }
        ) { merchant in
            HStack(spacing: 12) {
                Text(merchant.emoji)
                    .font(.title3)
                VStack(alignment: .leading, spacing: 4) {
                    Text(merchant.name)
                        .font(.subheadline.weight(.semibold))
                    HStack(spacing: 8) {
                        Text("\(merchant.visits) visits")
                        Text("·")
                        Text(MoneyFormatter.format(merchant.avgTransaction))
                            .monospacedDigit()
                    }
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    MoneyText(amount: merchant.total, font: .subheadline.weight(.bold))
                    Text(String(format: "%+.0f%%", merchant.trend))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(merchant.trend > 0 ? SpendFlowTheme.danger : SpendFlowTheme.success)
                }
            }
            .padding(.vertical, 4)
        }
    }
}
