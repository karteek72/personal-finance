import SwiftUI

@MainActor
@Observable
final class InvestmentsViewModel {
    var data: InvestmentsResponse?
    var holdingsQuery = ListQuery(page: 1, pageSize: 20)
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

        do {
            data = try await api.getInvestments(query: holdingsQuery)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reloadHoldings(api: APIClient) async {
        isLoadingHoldings = true
        defer { isLoadingHoldings = false }

        do {
            data = try await api.getInvestments(query: holdingsQuery)
        } catch {
            errorMessage = error.localizedDescription
        }
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
                portfolioHero(data: data)
                allocationSection(data: data)
                holdingsList(data: data, query: $bindableModel.holdingsQuery)
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    private func portfolioHero(data: InvestmentsResponse) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Portfolio value")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                MoneyText(amount: data.portfolioValue, font: .system(size: 32, weight: .heavy).monospacedDigit())

                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Cost basis")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(SpendFlowTheme.textMuted)
                        MoneyText(amount: data.totalCostBasis, font: .caption.weight(.bold))
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Gain / loss")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(SpendFlowTheme.textMuted)
                        HStack(spacing: 4) {
                            MoneyText(amount: data.totalGainLoss, font: .caption.weight(.bold))
                            Text(String(format: "%+.1f%%", data.totalGainLossPercent))
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(
                                    data.totalGainLossPercent >= 0 ? SpendFlowTheme.success : SpendFlowTheme.danger
                                )
                        }
                    }
                }
            }
        }
    }

    private func allocationSection(data: InvestmentsResponse) -> some View {
        let breakdown = data.portfolioBreakdown
        let points = [
            ChartDataPoint(id: "stocks", label: "Stocks", value: parseAmount(breakdown.stocksValue)),
            ChartDataPoint(id: "options", label: "Options", value: parseAmount(breakdown.optionsValue)),
            ChartDataPoint(id: "other", label: "Other", value: parseAmount(breakdown.otherValue)),
        ].filter { $0.value > 0 }

        return Group {
            if !points.isEmpty {
                SpendFlowChartView(
                    title: "Allocation",
                    points: points,
                    style: .bar,
                    yAxisLabel: "Value",
                    valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
                )
            }

            HStack(spacing: 12) {
                allocationChip(
                    label: "Stocks",
                    percent: breakdown.stocksSharePercent,
                    count: breakdown.stockPositionCount
                )
                allocationChip(
                    label: "Options",
                    percent: breakdown.optionsSharePercent,
                    count: breakdown.optionPositionCount
                )
            }
        }
    }

    private func allocationChip(label: String, percent: Double, count: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(SpendFlowTheme.textMuted)
            Text(String(format: "%.0f%%", percent))
                .font(.subheadline.weight(.bold))
            Text("\(count) positions")
                .font(.caption2)
                .foregroundStyle(SpendFlowTheme.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM)
                .stroke(SpendFlowTheme.border.opacity(0.6), lineWidth: 1)
        )
    }

    private func holdingsList(data: InvestmentsResponse, query: Binding<ListQuery>) -> some View {
        PaginatedListView(
            title: "Holdings",
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
            onSearch: { query in
                Task { await viewModel.searchHoldings(query, api: appState.apiClient) }
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
        guard let decimal = Decimal(string: amount) else { return 0 }
        return NSDecimalNumber(decimal: decimal).doubleValue
    }
}
