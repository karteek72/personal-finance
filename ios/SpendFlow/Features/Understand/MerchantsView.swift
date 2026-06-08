import SwiftUI

private enum MerchantsTab: String, CaseIterable, Identifiable {
    case merchants
    case income

    var id: String { rawValue }

    var label: String {
        switch self {
        case .merchants: "Merchants"
        case .income: "Income"
        }
    }
}

@MainActor
@Observable
final class MerchantsViewModel {
    var rows: [MerchantRow] = []
    var summary: MerchantsSummary?
    var incomeData: MerchantsResponse?
    var page = 1
    var totalPages = 1
    var query = ListQuery(page: 1, pageSize: 10, sort: "total", dir: .desc)
    var isLoading = false
    var isLoadingIncome = false
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

    func loadIncome(api: APIClient) async {
        isLoadingIncome = true
        defer { isLoadingIncome = false }

        do {
            incomeData = try await api.getMerchants()
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
    @State private var tab: MerchantsTab = .merchants

    var body: some View {
        SpendFlowScreen(title: "Merchants", subtitle: "Top spend & income analytics") {
            tabPicker
            switch tab {
            case .merchants:
                merchantsContent
            case .income:
                incomeContent
            }
        }
        .refreshable {
            await reloadCurrentTab()
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
            await viewModel.loadIncome(api: appState.apiClient)
        }
    }

    private var tabPicker: some View {
        HStack(spacing: 8) {
            ForEach(MerchantsTab.allCases) { item in
                let selected = tab == item
                Button {
                    tab = item
                    Task { await reloadCurrentTab() }
                } label: {
                    Text(item.label)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(selected ? SpendFlowTheme.primary : SpendFlowTheme.surface, in: Capsule())
                        .foregroundStyle(selected ? .white : SpendFlowTheme.textMuted)
                        .overlay(Capsule().stroke(selected ? Color.clear : SpendFlowTheme.border))
                }
                .buttonStyle(.plain)
            }
            Spacer()
            if tab == .income, let isLive = viewModel.incomeData?.isLive {
                MetricLiveBadge(isLive: isLive)
            }
        }
    }

    @ViewBuilder
    private var merchantsContent: some View {
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

    @ViewBuilder
    private var incomeContent: some View {
        if viewModel.isLoadingIncome, viewModel.incomeData == nil {
            LoadingStateView(message: "Loading income…")
        } else if let data = viewModel.incomeData {
            if data.income.primary.isEmpty {
                FeatureEmptyCard(
                    title: "No income data yet",
                    message: "Link accounts and sync transactions to see income analytics."
                )
            } else {
                incomeKpis(data)
                incomeStackedChart(data)
                incomeInsightCard(data)
            }
        }
    }

    private func incomeKpis(_ data: MerchantsResponse) -> some View {
        let summary = data.incomeSummary
        let stability = summary.incomeStability
        return VStack(spacing: 12) {
            HStack(spacing: 12) {
                KpiCard(label: "Avg income", value: MoneyFormatter.format(summary.avgMonthlyIncome), emoji: "💰", tone: .primary)
                KpiCard(
                    label: "Stability",
                    value: "\(Int(stability))%",
                    emoji: "📊",
                    tone: stability >= 90 ? .success : .warning
                )
            }
            HStack(spacing: 12) {
                KpiCard(label: "Side income", value: MoneyFormatter.format(summary.sideIncomeTotal), emoji: "✨", tone: .success)
                KpiCard(label: "Sources", value: "\(data.incomeSources)", emoji: "🏦", tone: .neutral)
            }
        }
    }

    private func incomeStackedChart(_ data: MerchantsResponse) -> some View {
        let months = data.income.months
        let primary = data.income.primary
        let side = data.income.side
        let maxTotal = max(data.incomeSummary.maxBarTotal, 1)

        return GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Income by month")
                    .font(.headline)
                Text("Primary salary + side income")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)

                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(months.enumerated()), id: \.offset) { index, month in
                        let p = primary.indices.contains(index) ? primary[index] : 0
                        let s = side.indices.contains(index) ? side[index] : 0
                        VStack(spacing: 4) {
                            VStack(spacing: 0) {
                                Rectangle()
                                    .fill(SpendFlowTheme.success.opacity(0.85))
                                    .frame(height: CGFloat(s / maxTotal) * 120)
                                Rectangle()
                                    .fill(SpendFlowTheme.primary.opacity(0.85))
                                    .frame(height: CGFloat(p / maxTotal) * 120)
                            }
                            .frame(maxWidth: .infinity)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            Text(AnalyticsUI.shortMonth(month))
                                .font(.caption2)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                        }
                    }
                }
                .frame(height: 150)

                HStack(spacing: 16) {
                    Label("Primary", systemImage: "circle.fill")
                        .font(.caption2)
                        .foregroundStyle(SpendFlowTheme.primary)
                    Label("Side", systemImage: "circle.fill")
                        .font(.caption2)
                        .foregroundStyle(SpendFlowTheme.success)
                }
            }
        }
    }

    private func incomeInsightCard(_ data: MerchantsResponse) -> some View {
        let sideTotal = data.incomeSummary.sideIncomeTotal
        let sideAmount = AnalyticsUI.parseAmount(sideTotal)
        guard sideAmount > 0 else { return AnyView(EmptyView()) }

        return AnyView(
            GlassCard {
                Label(
                    "Side income contributed \(MoneyFormatter.format(sideTotal)) over the last 6 months across \(data.incomeSources) sources.",
                    systemImage: "lightbulb.fill"
                )
                .font(.caption)
            }
        )
    }

    private func reloadCurrentTab() async {
        switch tab {
        case .merchants:
            await viewModel.load(api: appState.apiClient)
        case .income:
            await viewModel.loadIncome(api: appState.apiClient)
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
