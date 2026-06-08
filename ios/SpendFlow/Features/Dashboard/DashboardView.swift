import SwiftUI

@MainActor
@Observable
final class DashboardViewModel {
    var summary: TransactionSummary?
    var chartData: ChartDataResponse?
    var accounts: [Account] = []
    var members: [HouseholdMember] = []
    var profile: UserProfileResponse?
    var alerts: [Alert] = []

    var selectedAccountId = ""
    var selectedCategory = ""
    var selectedMemberId = ""
    var scope: ViewScope = .all

    var isLoading = false
    var isChartLoading = false
    var errorMessage: String?

    func load(api: APIClient, period: AnalyticsPeriodStore) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let range = period.dateRange

        do {
            async let summaryTask = api.getSummary(from: range.from, to: range.to)
            async let alertsTask = api.getAlerts()
            async let accountsTask = api.getAccounts()
            async let profileTask = api.getUserProfile()

            summary = try await summaryTask
            alerts = try await alertsTask.alerts
            accounts = try await accountsTask.accounts
            profile = try await profileTask

            if let household = try? await api.getHousehold() {
                members = household.members
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
        if !selectedMemberId.isEmpty {
            filters.memberId = selectedMemberId
        } else {
            filters.scope = scope
        }

        do {
            chartData = try await api.getChartData(filters: filters)
        } catch {
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }
    }

    var categoryNames: [String] {
        chartData?.byCategory.map(\.name) ?? []
    }

    func clearFilters() {
        selectedAccountId = ""
        selectedCategory = ""
        selectedMemberId = ""
    }

    func drilldownConfig(
        title: String,
        subtitle: String?,
        type: TransactionType? = .expense
    ) -> TransactionsDrilldownConfig {
        var filters = TransactionFilters()
        filters.type = type
        if !selectedCategory.isEmpty { filters.category = selectedCategory }
        if !selectedAccountId.isEmpty { filters.accountId = selectedAccountId }
        if !selectedMemberId.isEmpty {
            filters.memberId = selectedMemberId
        } else {
            filters.scope = scope
        }
        return TransactionsDrilldownConfig(title: title, subtitle: subtitle, filters: filters)
    }
}

struct DashboardView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DashboardViewModel()
    @State private var drilldownConfig: TransactionsDrilldownConfig?
    @State private var showProfile = false

    var body: some View {
        SpendFlowScreen(title: greetingTitle, subtitle: "Your money, minus the stress ✨") {
            content
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
        .onChange(of: viewModel.selectedCategory) { _, _ in
            Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
        }
        .onChange(of: viewModel.selectedMemberId) { _, _ in
            Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
        }
        .onChange(of: viewModel.scope) { _, _ in
            Task { await viewModel.loadChartData(api: appState.apiClient, period: appState.analyticsPeriod) }
        }
        .sheet(item: $drilldownConfig) { config in
            NavigationStack {
                TransactionsDrilldownView(config: config)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") { drilldownConfig = nil }
                        }
                    }
            }
        }
        .sheet(isPresented: $showProfile) {
            NavigationStack {
                ProfileView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") { showProfile = false }
                        }
                    }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading, viewModel.summary == nil {
            LoadingStateView(message: "Loading your vibe check…")
        } else if let error = viewModel.errorMessage, viewModel.summary == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient, period: appState.analyticsPeriod) }
            }
        } else if let summary = viewModel.summary {
            AnalyticsPeriodPicker(store: appState.analyticsPeriod)
            profileNudge
            heroCard(summary: summary)
            alertsSection
            analyticsSection
            quickStats(summary: summary)
        }
    }

    @ViewBuilder
    private var profileNudge: some View {
        if viewModel.profile?.isDefaultAge == true {
            Button {
                showProfile = true
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(SpendFlowTheme.warning)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Set up your analytics profile")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(SpendFlowTheme.text)
                        Text("Age is still defaulted to 35. Add your age & preferences →")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                }
                .padding(14)
                .background(SpendFlowTheme.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
                .overlay(
                    RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                        .stroke(SpendFlowTheme.warning.opacity(0.35), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var analyticsSection: some View {
        AnalyticsFilterBar(
            accounts: viewModel.accounts,
            categories: viewModel.categoryNames,
            members: viewModel.members,
            selectedAccountId: $viewModel.selectedAccountId,
            selectedCategory: $viewModel.selectedCategory,
            selectedMemberId: $viewModel.selectedMemberId,
            scope: $viewModel.scope,
            onClear: { viewModel.clearFilters() }
        )

        if viewModel.isChartLoading, viewModel.chartData == nil {
            LoadingStateView(message: "Loading charts…")
        } else if let chartData = viewModel.chartData {
            monthlyChart(chartData)
            categoryDonut(chartData)
            if !chartData.byMember.isEmpty {
                memberDonut(chartData)
            }
            accountBarChart(chartData)

            if hasActiveFilter {
                Button("View transactions →") {
                    drilldownConfig = viewModel.drilldownConfig(
                        title: filterDrilldownTitle,
                        subtitle: "Matching transactions from the selected filter"
                    )
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(SpendFlowTheme.primary, in: Capsule())
            }
        }
    }

    private var hasActiveFilter: Bool {
        !viewModel.selectedAccountId.isEmpty
            || !viewModel.selectedCategory.isEmpty
            || !viewModel.selectedMemberId.isEmpty
    }

    private var filterDrilldownTitle: String {
        if !viewModel.selectedCategory.isEmpty { return viewModel.selectedCategory }
        if !viewModel.selectedMemberId.isEmpty {
            return viewModel.members.first { $0.id == viewModel.selectedMemberId }?.displayName ?? "Member"
        }
        if !viewModel.selectedAccountId.isEmpty {
            return viewModel.accounts.first { $0.id == viewModel.selectedAccountId }?.name ?? "Account"
        }
        return "Filtered"
    }

    private func monthlyChart(_ data: ChartDataResponse) -> some View {
        SpendFlowChartView(
            title: "Monthly spending",
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
        .onTapGesture {
            drilldownConfig = viewModel.drilldownConfig(
                title: "Monthly spending",
                subtitle: appState.analyticsPeriod.periodLabel
            )
        }
    }

    private func categoryDonut(_ data: ChartDataResponse) -> some View {
        SpendFlowDonutChart(
            title: "By category",
            subtitle: "Tap a slice to filter",
            slices: data.byCategory.map(DonutSlice.fromCategory),
            selectedID: viewModel.selectedCategory.isEmpty ? nil : viewModel.selectedCategory,
            onSelect: { category in
                viewModel.selectedCategory = category
                if !category.isEmpty {
                    drilldownConfig = viewModel.drilldownConfig(
                        title: category,
                        subtitle: "Expenses in \(category)"
                    )
                }
            }
        )
    }

    private func memberDonut(_ data: ChartDataResponse) -> some View {
        SpendFlowDonutChart(
            title: "By member",
            subtitle: "Tap a slice to filter",
            slices: data.byMember.map(DonutSlice.fromMember),
            selectedID: viewModel.selectedMemberId.isEmpty ? nil : viewModel.selectedMemberId,
            onSelect: { memberId in
                viewModel.selectedMemberId = memberId
                if !memberId.isEmpty,
                   let member = viewModel.members.first(where: { $0.id == memberId }) {
                    drilldownConfig = viewModel.drilldownConfig(
                        title: member.displayName,
                        subtitle: "Member spending"
                    )
                }
            }
        )
    }

    private func accountBarChart(_ data: ChartDataResponse) -> some View {
        SpendFlowChartView(
            title: "By account",
            points: data.byAccount.map { slice in
                ChartDataPoint(
                    id: slice.id,
                    label: slice.name,
                    value: AnalyticsUI.parseAmount(slice.amount)
                )
            },
            style: .bar,
            yAxisLabel: "Spent",
            valueFormatter: { MoneyFormatter.format(String(format: "%.2f", $0)) }
        )
        .onTapGesture {
            if !viewModel.selectedAccountId.isEmpty,
               let account = viewModel.accounts.first(where: { $0.id == viewModel.selectedAccountId }) {
                drilldownConfig = viewModel.drilldownConfig(
                    title: account.name,
                    subtitle: "Account spending"
                )
            }
        }
    }

    private func heroCard(summary: TransactionSummary) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Net savings · \(appState.analyticsPeriod.periodLabel)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                savingsChip(rate: summary.savingsRate)
            }

            Button {
                drilldownConfig = viewModel.drilldownConfig(
                    title: "Net savings",
                    subtitle: "Income minus expenses · \(appState.analyticsPeriod.periodLabel)",
                    type: nil
                )
            } label: {
                MoneyText(
                    amount: summary.netSavings,
                    font: .system(size: 42, weight: .heavy, design: .rounded).monospacedDigit()
                )
                .foregroundStyle(.white)
            }
            .buttonStyle(.plain)

            Text(vibeCopy(for: summary.netSavings))
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.9))

            HStack(spacing: 10) {
                miniStat(label: "Spent", amount: summary.totalSpent, emoji: "💸", type: .expense)
                miniStat(label: "Income", amount: summary.income, emoji: "💰", type: .income)
                miniStat(label: "Avg/mo", amount: summary.avgMonthlySpend, emoji: "📊", type: .expense)
            }
        }
        .padding(22)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(SpendFlowTheme.heroGradient)
        }
        .shadow(color: SpendFlowTheme.primary.opacity(0.35), radius: 20, x: 0, y: 10)
    }

    private func savingsChip(rate: Double) -> some View {
        Text(String(format: "%.0f%% saved", max(0, rate * 100)))
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.white.opacity(0.22))
            .clipShape(Capsule())
            .foregroundStyle(.white)
    }

    private func miniStat(label: String, amount: String, emoji: String, type: TransactionType?) -> some View {
        Button {
            drilldownConfig = viewModel.drilldownConfig(
                title: label,
                subtitle: appState.analyticsPeriod.periodLabel,
                type: type
            )
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(emoji) \(label)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white.opacity(0.8))
                MoneyText(amount: amount, font: .caption.weight(.bold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(.white.opacity(0.16))
            .clipShape(RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var alertsSection: some View {
        if !viewModel.alerts.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Heads up")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.text)
                ForEach(viewModel.alerts) { alert in
                    AlertBanner(alert: alert)
                }
            }
        }
    }

    private func quickStats(summary: TransactionSummary) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick hits")
                .font(.headline.weight(.bold))
                .foregroundStyle(SpendFlowTheme.text)
            HStack(spacing: 12) {
                Button {
                    drilldownConfig = viewModel.drilldownConfig(
                        title: summary.topCategory.name,
                        subtitle: "Top spending category",
                        type: .expense
                    )
                    viewModel.selectedCategory = summary.topCategory.name
                } label: {
                    KpiCard(
                        label: "Top category",
                        value: summary.topCategory.amount,
                        subtext: summary.topCategory.name,
                        emoji: "🔥",
                        tone: .primary
                    )
                }
                .buttonStyle(.plain)

                KpiCard(
                    label: "CC excluded",
                    value: summary.ccPaymentsExcluded,
                    emoji: "💳",
                    tone: .neutral
                )
            }
        }
    }

    private var greetingTitle: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    private func vibeCopy(for netSavings: String) -> String {
        MoneyFormatter.isNonNegative(netSavings)
            ? "You're lowkey winning — keep the streak going 🔥"
            : "Spending's running hot — worth a quick peek 👀"
    }
}
