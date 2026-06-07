import SwiftUI

enum RecurringTab: String, CaseIterable, Identifiable {
    case subscriptions
    case bills

    var id: String { rawValue }

    var label: String {
        switch self {
        case .subscriptions: "Subscriptions"
        case .bills: "Bills"
        }
    }
}

@MainActor
@Observable
final class RecurringViewModel {
    var data: RecurringResponse?
    var selectedTab: RecurringTab = .subscriptions
    var query = ListQuery(page: 1, pageSize: 20)
    var isLoading = false
    var isLoadingPage = false
    var errorMessage: String?

    var currentRows: [RecurringItem] {
        switch selectedTab {
        case .subscriptions: data?.subscriptions.rows ?? []
        case .bills: data?.bills.rows ?? []
        }
    }

    var currentPage: Page<RecurringItem>? {
        switch selectedTab {
        case .subscriptions: data?.subscriptions
        case .bills: data?.bills
        }
    }

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getRecurring(query: query)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reloadPage(api: APIClient) async {
        isLoadingPage = true
        defer { isLoadingPage = false }

        do {
            data = try await api.getRecurring(query: query)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func switchTab(_ tab: RecurringTab, api: APIClient) async {
        selectedTab = tab
        query.page = 1
        await reloadPage(api: api)
    }

    func nextPage(api: APIClient) async {
        guard let page = currentPage, page.page < page.totalPages else { return }
        query.page = page.page + 1
        await reloadPage(api: api)
    }

    func previousPage(api: APIClient) async {
        guard let page = currentPage, page.page > 1 else { return }
        query.page = page.page - 1
        await reloadPage(api: api)
    }

    func search(_ text: String, api: APIClient) async {
        query.q = text.isEmpty ? nil : text
        query.page = 1
        await reloadPage(api: api)
    }
}

struct RecurringView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = RecurringViewModel()

    var body: some View {
        @Bindable var bindableModel = viewModel
        SpendFlowScreen(title: "Recurring", subtitle: "Subscriptions, bills, and leaks") {
            if bindableModel.isLoading, bindableModel.data == nil {
                LoadingStateView(message: "Scanning recurring charges…")
            } else if let error = bindableModel.errorMessage, bindableModel.data == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else if let data = bindableModel.data {
                summaryHeader(data: data)
                PillFilterBar(
                    items: RecurringTab.allCases,
                    selection: $bindableModel.selectedTab,
                    label: \.label
                )
                .onChange(of: bindableModel.selectedTab) { _, newTab in
                    Task { await viewModel.switchTab(newTab, api: appState.apiClient) }
                }
                recurringList(query: $bindableModel.query)
                leaksSection(data: data)
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    private func summaryHeader(data: RecurringResponse) -> some View {
        HStack(spacing: 12) {
            KpiCard(label: "Monthly", value: data.monthlyTotal, emoji: "📅", tone: .primary)
            KpiCard(label: "Annual", value: data.annualTotal, emoji: "🗓️", tone: .neutral)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func recurringList(query: Binding<ListQuery>) -> some View {
        PaginatedListView(
            title: viewModel.selectedTab.label,
            query: query,
            rows: viewModel.currentRows,
            page: viewModel.currentPage?.page ?? 1,
            totalPages: viewModel.currentPage?.totalPages ?? 1,
            isLoading: viewModel.isLoadingPage,
            errorMessage: viewModel.errorMessage,
            onReload: {
                Task { await viewModel.reloadPage(api: appState.apiClient) }
            },
            onNextPage: {
                Task { await viewModel.nextPage(api: appState.apiClient) }
            },
            onPreviousPage: {
                Task { await viewModel.previousPage(api: appState.apiClient) }
            },
            onSearch: { query in
                Task { await viewModel.search(query, api: appState.apiClient) }
            }
        ) { item in
            recurringRow(item)
        }
    }

    private func recurringRow(_ item: RecurringItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(item.merchantName)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                MoneyText(amount: item.amount, font: .subheadline.weight(.bold))
            }
            HStack {
                Text(item.cadence.capitalized)
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Text(item.category)
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                if item.priceChanged {
                    Text("Price changed")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(SpendFlowTheme.warning)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func leaksSection(data: RecurringResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Leaks & audits")
                .font(.headline.weight(.bold))

            if !data.leaks.fees.isEmpty {
                subsection(title: "Fee leaks") {
                    ForEach(data.leaks.fees) { fee in
                        leakRow(title: fee.label, detail: "\(fee.count)× · \(fee.source)", amount: fee.total)
                    }
                }
            }

            if !data.leaks.habits.isEmpty {
                subsection(title: "Habit leaks") {
                    ForEach(data.leaks.habits) { habit in
                        leakRow(
                            title: "\(habit.emoji ?? "☕️") \(habit.label)",
                            detail: "Monthly habit",
                            amount: habit.monthly
                        )
                    }
                }
            }

            if !data.leaks.audits.isEmpty {
                subsection(title: "Cost audits") {
                    ForEach(data.leaks.audits) { audit in
                        auditRow(audit)
                    }
                }
            }

            if data.leaks.fees.isEmpty && data.leaks.habits.isEmpty && data.leaks.audits.isEmpty {
                Text("No leaks detected")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
        }
    }

    private func subsection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
            content()
        }
    }

    private func leakRow(title: String, detail: String, amount: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
            Spacer()
            MoneyText(amount: amount, font: .caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.danger)
        }
        .padding(12)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
    }

    private func auditRow(_ audit: CostAudit) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(audit.emoji) \(audit.title)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                MoneyText(amount: audit.monthly, font: .caption.weight(.bold))
            }
            Text(audit.rationale)
                .font(.caption)
                .foregroundStyle(SpendFlowTheme.textMuted)
            Text(audit.action)
                .font(.caption.weight(.semibold))
                .foregroundStyle(SpendFlowTheme.primary)
            HStack {
                Text("Save ~\(MoneyFormatter.format(audit.savingsEstimate))/mo")
                    .font(.caption2)
                Spacer()
                Text("10y opp. \(MoneyFormatter.format(audit.opportunityCost10y))")
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
        }
        .padding(14)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
    }
}
