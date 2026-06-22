import SwiftUI

@MainActor
@Observable
final class CategoriesViewModel {
    var categories: [CategoryTotal] = []
    var chartData: ChartDataResponse?
    var accounts: [Account] = []
    var members: [HouseholdMember] = []
    var selectedAccountId = ""
    var selectedMemberId = ""
    var selectedCategory = ""
    var isLoading = false
    var isChartLoading = false
    var errorMessage: String?

    var hasMultipleAccounts: Bool { accounts.count > 1 }
    var hasMultipleMembers: Bool { members.count > 1 }
    var showTopFilters: Bool { hasMultipleAccounts || hasMultipleMembers }

    func load(api: APIClient, period: AnalyticsPeriodStore) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let range = period.dateRange

        do {
            async let categoriesTask = api.getCategories(from: range.from, to: range.to)
            async let accountsTask = api.getAccounts()
            async let householdTask: HouseholdResponse? = {
                do { return try await api.getHousehold() } catch { return nil }
            }()

            let response = try await categoriesTask
            accounts = try await accountsTask.accounts
            if let household = await householdTask {
                members = household.members
            }
            categories = response.categories.sorted { lhs, rhs in
                (Decimal(string: lhs.amount) ?? 0) > (Decimal(string: rhs.amount) ?? 0)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        await loadChartData(api: api, period: period)
    }

    func loadChartData(api: APIClient, period: AnalyticsPeriodStore) async {
        isChartLoading = true
        defer { isChartLoading = false }

        let range = period.dateRange
        var filters = ChartDataFilters(from: range.from, to: range.to)
        if !selectedAccountId.isEmpty { filters.accountId = selectedAccountId }
        if !selectedCategory.isEmpty { filters.category = selectedCategory }
        if !selectedMemberId.isEmpty { filters.memberId = selectedMemberId }

        do {
            chartData = try await api.getChartData(filters: filters)
        } catch {
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }
    }

    var displayCategories: [CategoryTotal] {
        guard let slices = chartData?.byCategory, !slices.isEmpty else {
            return categories
        }

        let subMap = Dictionary(uniqueKeysWithValues: categories.map { ($0.name, $0.subcategories ?? []) })
        let deltaMap = Dictionary(uniqueKeysWithValues: categories.map { ($0.name, $0.deltaVsPriorMonth) })

        return slices.map { slice in
            CategoryTotal(
                name: slice.name,
                amount: slice.amount,
                percentage: slice.percentage,
                deltaVsPriorMonth: deltaMap[slice.name] ?? 0,
                subcategories: subMap[slice.name]
            )
        }
    }

    func clearFilters() {
        selectedAccountId = ""
        selectedMemberId = ""
        selectedCategory = ""
    }
}

struct CategoriesView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CategoriesViewModel()

    var body: some View {
        SpendFlowScreen(title: "Spend", subtitle: "Where your money actually goes") {
            if viewModel.isLoading, viewModel.categories.isEmpty, viewModel.chartData == nil {
                LoadingStateView(message: "Crunching categories…")
            } else if let error = viewModel.errorMessage, viewModel.categories.isEmpty, viewModel.chartData == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient, period: appState.analyticsPeriod) }
                }
            } else {
                AnalyticsPeriodPicker(store: appState.analyticsPeriod)
                topFilters

                if viewModel.isChartLoading, viewModel.chartData == nil {
                    LoadingStateView(message: "Loading charts…")
                } else if let chartData = viewModel.chartData {
                    CashFlowOverviewStrips(
                        monthly: chartData.monthly,
                        yearly: chartData.yearly,
                        periodTitle: appState.analyticsPeriod.periodLabel,
                        accountFiltered: !viewModel.selectedAccountId.isEmpty || !viewModel.selectedMemberId.isEmpty
                    )

                    chartFilterBar
                    categoryCharts(chartData)
                }

                breakdownList
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient, period: appState.analyticsPeriod)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient, period: appState.analyticsPeriod)
        }
        .onChange(of: appState.analyticsPeriod.period) { _, _ in
            Task { await viewModel.load(api: appState.apiClient, period: appState.analyticsPeriod) }
        }
        .onChange(of: viewModel.selectedAccountId) { _, _ in
            Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
        }
        .onChange(of: viewModel.selectedMemberId) { _, _ in
            Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
        }
        .onChange(of: viewModel.selectedCategory) { _, _ in
            Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
        }
    }

    @ViewBuilder
    private var topFilters: some View {
        if viewModel.showTopFilters {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                if viewModel.hasMultipleMembers {
                    FilterMenuField(
                        title: "Person",
                        selection: memberLabel,
                        options: memberOptions
                    ) { option in
                        viewModel.selectedMemberId = option.id
                        Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
                    }
                }
                if viewModel.hasMultipleAccounts {
                    FilterMenuField(
                        title: "Account",
                        selection: accountLabel,
                        options: accountOptions
                    ) { option in
                        viewModel.selectedAccountId = option.id
                        Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
                    }
                }
            }
        }
    }

    private var memberOptions: [FilterMenuOption] {
        [FilterMenuOption(id: "", label: "All people")]
            + viewModel.members.map { FilterMenuOption(id: $0.id, label: $0.displayName) }
    }

    private var accountOptions: [FilterMenuOption] {
        [FilterMenuOption(id: "", label: "All accounts")]
            + viewModel.accounts.map { account in
                let label = account.mask.map { "\(account.name) ••\($0)" } ?? account.name
                return FilterMenuOption(id: account.id, label: label)
            }
    }

    private var memberLabel: String {
        memberOptions.first(where: { $0.id == viewModel.selectedMemberId })?.label ?? "All people"
    }

    private var accountLabel: String {
        accountOptions.first(where: { $0.id == viewModel.selectedAccountId })?.label ?? "All accounts"
    }

    private var chartFilterBar: some View {
        AnalyticsFilterBar(
            accounts: viewModel.accounts,
            categories: viewModel.chartData?.byCategory.map(\.name) ?? [],
            members: viewModel.members,
            selectedAccountId: $viewModel.selectedAccountId,
            selectedCategory: $viewModel.selectedCategory,
            selectedMemberId: $viewModel.selectedMemberId,
            scope: .constant(.all),
            showScope: false,
            showMembers: !viewModel.hasMultipleMembers,
            showAccounts: !viewModel.hasMultipleAccounts,
            showCategories: true,
            onClear: { viewModel.clearFilters() }
        )
    }

    @ViewBuilder
    private func categoryCharts(_ data: ChartDataResponse) -> some View {
        SpendFlowDonutChart(
            title: "By category",
            subtitle: "Tap a slice to drill down",
            slices: data.byCategory.map(DonutSlice.fromCategory),
            selectedID: viewModel.selectedCategory.isEmpty ? nil : viewModel.selectedCategory,
            onSelect: { category in
                viewModel.selectedCategory = category
            }
        )

        if !viewModel.selectedCategory.isEmpty, !data.bySubCategory.isEmpty {
            SpendFlowDonutChart(
                title: "\(viewModel.selectedCategory) breakdown",
                subtitle: "Subcategories",
                slices: data.bySubCategory.map(DonutSlice.fromCategory),
                selectedID: nil,
                onSelect: nil
            )
        }

        SpendFlowChartView(
            title: "Monthly cash flow",
            points: data.monthly.map { point in
                ChartDataPoint(
                    id: point.month,
                    label: AnalyticsUI.shortMonth(point.month),
                    value: AnalyticsUI.parseAmount(point.expenses)
                )
            },
            style: .line,
            yAxisLabel: "Spent",
            valueFormatter: { MoneyFormatter.format(String(format: "%.2f", $0)) }
        )

        SpendFlowTrendChart(
            title: "Category trends",
            subtitle: "Filters apply to all charts above",
            trends: data.categoryTrends,
            highlightedCategory: viewModel.selectedCategory.isEmpty ? nil : viewModel.selectedCategory,
            onSelectCategory: { category in
                viewModel.selectedCategory = category
            }
        )
    }

    private var breakdownList: some View {
        LazyVStack(spacing: 10) {
            ForEach(Array(viewModel.displayCategories.enumerated()), id: \.element.id) { index, category in
                CategoryRow(
                    category: category,
                    rank: index + 1,
                    isSelected: viewModel.selectedCategory == category.name
                )
                .onTapGesture {
                    viewModel.selectedCategory = viewModel.selectedCategory == category.name ? "" : category.name
                }
            }
        }
    }
}

private struct CategoryRow: View {
    let category: CategoryTotal
    let rank: Int
    var isSelected = false

    var body: some View {
        HStack(spacing: 14) {
            Text("#\(rank)")
                .font(.caption.weight(.black))
                .foregroundStyle(SpendFlowTheme.primary.opacity(0.7))
                .frame(width: 28)

            CategoryChip(color: CategoryColor.forCategory(category.name))

            VStack(alignment: .leading, spacing: 3) {
                Text(category.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.text)
                HStack(spacing: 6) {
                    Text("\(Int(category.percentage.rounded()))% of spend")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                    deltaBadge
                }
            }

            Spacer(minLength: 8)

            MoneyText(amount: category.amount, font: .subheadline.weight(.bold))
        }
        .padding(14)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .fill(isSelected ? SpendFlowTheme.primarySoft : SpendFlowTheme.surface)
        }
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .stroke(
                    isSelected ? SpendFlowTheme.primary.opacity(0.5) : SpendFlowTheme.border.opacity(0.7),
                    lineWidth: 1
                )
        )
    }

    @ViewBuilder
    private var deltaBadge: some View {
        let delta = category.deltaVsPriorMonth
        if abs(delta) >= 0.1 {
            Text(String(format: "%+.0f%%", delta))
                .font(.system(size: 10, weight: .bold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background((delta > 0 ? SpendFlowTheme.danger : SpendFlowTheme.success).opacity(0.12))
                .foregroundStyle(delta > 0 ? SpendFlowTheme.danger : SpendFlowTheme.success)
                .clipShape(Capsule())
        }
    }
}
