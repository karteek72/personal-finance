import SwiftUI

private enum InvestmentsTab: String, CaseIterable, Identifiable {
    case stocks
    case options
    case behavioral

    var id: String { rawValue }

    var label: String {
        switch self {
        case .stocks: "Stocks & ETFs"
        case .options: "Options"
        case .behavioral: "Behavioral"
        }
    }
}

@MainActor
@Observable
final class InvestmentsViewModel {
    var data: InvestmentsResponse?
    var holdingsQuery = ListQuery(page: 1, pageSize: 20, sort: "value", dir: .desc)
    var selectedAccountId: String?
    var activeTab: InvestmentsTab = .stocks
    var isLoading = false
    var isLoadingHoldings = false
    var errorMessage: String?

    var holdings: [InvestmentHolding] {
        data?.holdings.rows ?? []
    }

    var holdingsPage: Int { data?.holdings.page ?? 1 }
    var holdingsTotalPages: Int { data?.holdings.totalPages ?? 1 }

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        var query = holdingsQuery
        query.accountId = selectedAccountId
        query.kind = activeTab == .options ? "options" : activeTab == .stocks ? "stocks" : nil

        do {
            data = try await api.getInvestments(query: query)
            holdingsQuery = query
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reloadHoldings(api: APIClient) async {
        isLoadingHoldings = true
        defer { isLoadingHoldings = false }
        await load(api: api)
    }

    func nextHoldingsPage(api: APIClient) async {
        guard holdingsPage < holdingsTotalPages else { return }
        holdingsQuery.page = holdingsPage + 1
        await reloadHoldings(api: api)
    }

    func previousHoldingsPage(api: APIClient) async {
        guard holdingsPage > 1 else { return }
        holdingsQuery.page = holdingsPage - 1
        await reloadHoldings(api: api)
    }

    func searchHoldings(_ query: String, api: APIClient) async {
        holdingsQuery.q = query.isEmpty ? nil : query
        holdingsQuery.page = 1
        await reloadHoldings(api: api)
    }

    func selectAccount(_ accountId: String?, api: APIClient) async {
        selectedAccountId = accountId
        holdingsQuery.page = 1
        await load(api: api)
    }

    func selectTab(_ tab: InvestmentsTab, api: APIClient) async {
        activeTab = tab
        holdingsQuery.page = 1
        if tab != .behavioral {
            await load(api: api)
        }
    }
}

struct InvestmentsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = InvestmentsViewModel()

    var body: some View {
        @Bindable var bindableModel = viewModel
        SpendFlowScreen(title: "Investments", subtitle: "Portfolio value, holdings & allocation") {
            if bindableModel.isLoading, bindableModel.data == nil {
                LoadingStateView(message: "Loading portfolio…")
            } else if let error = bindableModel.errorMessage, bindableModel.data == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else if let data = bindableModel.data {
                accountFilter(data)
                kpiHeader(data)
                analyticsCharts(data)
                tabBar(data)
                tabContent(data, query: $bindableModel.holdingsQuery)
                trimLosersSection(data.pruneLosers)
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    private func accountFilter(_ data: InvestmentsResponse) -> some View {
        Group {
            if !data.accounts.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        accountChip(label: "All accounts", accountId: nil)
                        ForEach(data.accounts) { account in
                            accountChip(
                                label: "\(account.name) (\(MoneyFormatter.format(account.value)))",
                                accountId: account.accountId
                            )
                        }
                    }
                }
            }
        }
    }

    private func accountChip(label: String, accountId: String?) -> some View {
        let selected = viewModel.selectedAccountId == accountId
        return Button {
            Task { await viewModel.selectAccount(accountId, api: appState.apiClient) }
        } label: {
            Text(label)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(selected ? SpendFlowTheme.primary : SpendFlowTheme.surface, in: Capsule())
                .foregroundStyle(selected ? .white : SpendFlowTheme.textMuted)
                .overlay(Capsule().stroke(selected ? Color.clear : SpendFlowTheme.border))
        }
        .buttonStyle(.plain)
    }

    private func kpiHeader(_ data: InvestmentsResponse) -> some View {
        let analytics = data.portfolioAnalytics
        return HeroGradientCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Portfolio value")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.7))
                        MoneyText(amount: data.portfolioValue, font: .title.weight(.heavy))
                            .foregroundStyle(.white)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Win rate")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.7))
                        Text("\(Int(analytics.winRate))%")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.white)
                    }
                }

                HStack(spacing: 16) {
                    kpiMini(label: "P/L", value: data.totalGainLoss, suffix: String(format: "%+.1f%%", data.totalGainLossPercent))
                    kpiMini(label: "Cost basis", value: data.totalCostBasis, suffix: nil)
                }

                HStack(spacing: 12) {
                    grossChip(label: "Gross profit", amount: analytics.unrealizedProfit.total, tone: SpendFlowTheme.success)
                    grossChip(label: "Gross loss", amount: analytics.unrealizedLoss.total, tone: SpendFlowTheme.danger)
                }
            }
        }
    }

    private func kpiMini(label: String, value: String, suffix: String?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.7))
            HStack(spacing: 4) {
                MoneyText(amount: value, font: .caption.weight(.bold))
                    .foregroundStyle(.white)
                if let suffix {
                    Text(suffix)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
        }
    }

    private func grossChip(label: String, amount: String, tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.6))
            MoneyText(amount: amount, font: .caption.weight(.semibold))
                .foregroundStyle(tone)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.white.opacity(0.12), in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
    }

    private func analyticsCharts(_ data: InvestmentsResponse) -> some View {
        let analytics = data.portfolioAnalytics
        let breakdown = data.portfolioBreakdown

        return VStack(spacing: 12) {
            if !analytics.caveats.isEmpty {
                Text(analytics.caveats.joined(separator: " "))
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }

            let allocationPoints = [
                ChartDataPoint(id: "stocks", label: "Stocks", value: parseAmount(breakdown.stocksValue)),
                ChartDataPoint(id: "options", label: "Options", value: parseAmount(breakdown.optionsValue)),
                ChartDataPoint(id: "other", label: "Other", value: parseAmount(breakdown.otherValue)),
            ].filter { $0.value > 0 }

            if !allocationPoints.isEmpty {
                SpendFlowChartView(
                    title: "Asset allocation",
                    points: allocationPoints,
                    style: .bar,
                    yAxisLabel: "Value",
                    valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
                )
            }

            if !analytics.sectorAllocation.isEmpty {
                SpendFlowChartView(
                    title: "Sector allocation",
                    points: analytics.sectorAllocation.map {
                        ChartDataPoint(id: $0.sector, label: $0.sector, value: parseAmount($0.value))
                    },
                    style: .bar,
                    yAxisLabel: "Value",
                    valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
                )
            }

            let winnersLosers = [
                ChartDataPoint(id: "winners", label: "Winners", value: parseAmount(analytics.winners.value)),
                ChartDataPoint(id: "losers", label: "Losers", value: parseAmount(analytics.losers.value)),
            ].filter { $0.value > 0 }

            if !winnersLosers.isEmpty {
                SpendFlowChartView(
                    title: "Winners vs losers",
                    points: winnersLosers,
                    style: .bar,
                    yAxisLabel: "Value",
                    valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
                )
            }

            if !data.portfolioValueTrend.points.isEmpty {
                SpendFlowChartView(
                    title: "Portfolio value trend",
                    points: data.portfolioValueTrend.points.map {
                        ChartDataPoint(id: $0.month, label: AnalyticsUI.shortMonth($0.month), value: parseAmount($0.value))
                    },
                    style: .line,
                    yAxisLabel: "Value",
                    valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
                )
            }
        }
    }

    private func tabBar(_ data: InvestmentsResponse) -> some View {
        HStack(spacing: 16) {
            ForEach(InvestmentsTab.allCases) { tab in
                let selected = viewModel.activeTab == tab
                Button {
                    Task { await viewModel.selectTab(tab, api: appState.apiClient) }
                } label: {
                    VStack(spacing: 2) {
                        Text(tab.label)
                            .font(.caption.weight(.semibold))
                        if tab == .behavioral, !data.behavioralAlerts.isEmpty {
                            Text("\(data.behavioralAlerts.count) alerts")
                                .font(.caption2)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                        }
                    }
                    .padding(.bottom, 6)
                    .overlay(alignment: .bottom) {
                        if selected {
                            Rectangle()
                                .fill(SpendFlowTheme.primary)
                                .frame(height: 2)
                        }
                    }
                    .foregroundStyle(selected ? SpendFlowTheme.text : SpendFlowTheme.textMuted)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func tabContent(_ data: InvestmentsResponse, query: Binding<ListQuery>) -> some View {
        switch viewModel.activeTab {
        case .stocks, .options:
            holdingsList(data: data, query: query)
        case .behavioral:
            behavioralTab(data)
        }
    }

    private func behavioralTab(_ data: InvestmentsResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let activity = data.monthlyActivity {
                HStack(spacing: 12) {
                    KpiCard(label: "Cash in", value: activity.cashContributions, emoji: "💵", tone: .success)
                    KpiCard(label: "Deployed", value: activity.totalDeployed, emoji: "📈", tone: .primary)
                }
            }

            if data.behavioralAlerts.isEmpty {
                FeatureEmptyCard(title: "No alerts", message: "Your investment behavior looks steady.")
            } else {
                ForEach(data.behavioralAlerts) { alert in
                    GlassCard {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(alert.title).font(.subheadline.weight(.semibold))
                            Text(alert.desc).font(.caption).foregroundStyle(SpendFlowTheme.textMuted)
                        }
                    }
                }
            }
        }
    }

    private func trimLosersSection(_ pruneLosers: PruneLosersResponse) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Trim losers (what-if)")
                    .font(.headline)

                if !pruneLosers.available {
                    Text(pruneLosers.caveats.last ?? "Momentum scoring unavailable until enough price history is collected.")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                } else if let whatIf = pruneLosers.whatIf, !pruneLosers.cutCandidates.isEmpty {
                    Text(pruneLosers.caveats.prefix(2).joined(separator: " "))
                        .font(.caption2)
                        .foregroundStyle(SpendFlowTheme.textMuted)

                    HStack(spacing: 8) {
                        trimKpi(label: "Capital freed", value: whatIf.capitalFreed)
                        trimKpi(label: "Harvestable loss", value: whatIf.harvestableLoss)
                    }

                    ForEach(pruneLosers.cutCandidates.prefix(5)) { candidate in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(candidate.ticker) · \(candidate.name)")
                                    .font(.caption.weight(.semibold))
                                Text("Momentum \(Int(candidate.momentumScore))")
                                    .font(.caption2)
                                    .foregroundStyle(SpendFlowTheme.textMuted)
                            }
                            Spacer()
                            MoneyText(amount: candidate.gainLoss, font: .caption.weight(.bold))
                                .foregroundStyle(SpendFlowTheme.danger)
                        }
                    }
                } else {
                    Text("No cut candidates right now.")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
            }
        }
    }

    private func trimKpi(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(SpendFlowTheme.textMuted)
            MoneyText(amount: value, font: .caption.weight(.bold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
    }

    private func holdingsList(data: InvestmentsResponse, query: Binding<ListQuery>) -> some View {
        PaginatedListView(
            title: viewModel.activeTab == .options ? "Option positions" : "Holdings",
            query: query,
            rows: viewModel.holdings,
            page: viewModel.holdingsPage,
            totalPages: viewModel.holdingsTotalPages,
            isLoading: viewModel.isLoadingHoldings,
            errorMessage: viewModel.errorMessage,
            onReload: {
                Task { await viewModel.reloadHoldings(api: appState.apiClient) }
            },
            onNextPage: {
                Task { await viewModel.nextHoldingsPage(api: appState.apiClient) }
            },
            onPreviousPage: {
                Task { await viewModel.previousHoldingsPage(api: appState.apiClient) }
            },
            onSearch: { searchQuery in
                Task { await viewModel.searchHoldings(searchQuery, api: appState.apiClient) }
            }
        ) { holding in
            holdingRow(holding)
        }
    }

    private func holdingRow(_ holding: InvestmentHolding) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(holding.ticker)
                    .font(.subheadline.weight(.bold))
                Text(holding.name)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .lineLimit(1)
                Spacer()
                MoneyText(amount: holding.value, font: .subheadline.weight(.semibold))
            }
            HStack {
                Text("\(holding.quantity, specifier: "%.2f") shares")
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                if let sector = holding.sector {
                    Text(sector)
                        .font(.caption2)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
                Spacer()
                Text(String(format: "%+.1f%%", holding.gainLossPercent))
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(
                        holding.gainLossPercent >= 0 ? SpendFlowTheme.success : SpendFlowTheme.danger
                    )
            }
        }
        .padding(.vertical, 4)
    }

    private func parseAmount(_ amount: String) -> Double {
        AnalyticsUI.parseAmount(amount)
    }
}
