import SwiftUI

struct TransactionsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = TransactionsViewModel()

    var body: some View {
        @Bindable var bindableModel = viewModel
        SpendFlowScreen(title: "Activity", subtitle: "Every swipe, every subscription 👀") {
            if !viewModel.householdMembers.isEmpty {
                memberPills
            }

            PillFilterBar(
                items: TransactionsViewModel.TransactionTypeFilter.allCases,
                selection: $bindableModel.filter,
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
            .onChange(of: bindableModel.filter) { _, newValue in
                if newValue != .expense {
                    bindableModel.categorizationStatus = nil
                }
                Task { await viewModel.reload(api: appState.apiClient) }
            }

            scopePills

            searchBar

            filterMenus

            if viewModel.categorizationStatus != nil {
                Text("Showing expenses that need a category or subcategory. Tap a row to classify it.")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SpendFlowTheme.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
            }

            if let feedback = viewModel.feedbackMessage {
                Text(feedback)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.primary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SpendFlowTheme.primarySoft, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
            }

            transactionsContent
        }
        .refreshable {
            await viewModel.reload(api: appState.apiClient)
        }
        .task {
            await viewModel.loadMetadata(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.reload(api: appState.apiClient)
        }
        .sheet(item: $viewModel.editingTransaction) { transaction in
            TransactionCategoryEditSheet(transaction: transaction) { category, subCategory, remember in
                try await viewModel.saveCategory(
                    transaction: transaction,
                    category: category,
                    subCategory: subCategory,
                    rememberForMerchant: remember,
                    api: appState.apiClient,
                    refresh: appState.refreshCenter
                )
            }
        }
    }

    private var memberPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                memberPill(
                    id: "",
                    label: "All family",
                    color: nil,
                    isSelected: viewModel.selectedMemberId == nil
                ) {
                    viewModel.selectedMemberId = nil
                    Task { await viewModel.reload(api: appState.apiClient) }
                }

                ForEach(viewModel.householdMembers) { member in
                    memberPill(
                        id: member.id,
                        label: member.displayName,
                        color: Color(hex: member.avatarColor),
                        isSelected: viewModel.selectedMemberId == member.id
                    ) {
                        viewModel.selectedMemberId = viewModel.selectedMemberId == member.id ? nil : member.id
                        Task { await viewModel.reload(api: appState.apiClient) }
                    }
                }
            }
            .padding(.horizontal, 2)
        }
    }

    private func memberPill(
        id: String,
        label: String,
        color: Color?,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let color {
                    Circle()
                        .fill(color)
                        .frame(width: 8, height: 8)
                }
                Text(label)
                    .font(.caption.weight(.semibold))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background {
                Capsule()
                    .fill(isSelected ? SpendFlowTheme.primary : SpendFlowTheme.surface)
            }
            .overlay {
                Capsule()
                    .stroke(isSelected ? Color.clear : SpendFlowTheme.border, lineWidth: 1)
            }
            .foregroundStyle(isSelected ? .white : SpendFlowTheme.textMuted)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id.isEmpty ? "member-all" : "member-\(id)")
    }

    private var scopePills: some View {
        PillFilterBar(
            items: TransactionsViewModel.ScopeFilter.allCases,
            selection: Binding(
                get: { TransactionsViewModel.ScopeFilter(viewScope: viewModel.scope) },
                set: { viewModel.scope = $0.viewScope }
            ),
            label: \.label,
            emoji: { scope in
                switch scope {
                case .all: "🌐"
                case .household: "👨‍👩‍👧"
                case .personal: "🙋"
                }
            }
        )
        .onChange(of: viewModel.scope) { _, _ in
            Task { await viewModel.reload(api: appState.apiClient) }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(SpendFlowTheme.textMuted)
            TextField("Search merchants…", text: $viewModel.searchText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onSubmit {
                    Task { await viewModel.reload(api: appState.apiClient) }
                }
            if !viewModel.searchText.isEmpty {
                Button("Clear") {
                    viewModel.searchText = ""
                    Task { await viewModel.reload(api: appState.apiClient) }
                }
                .font(.caption.weight(.semibold))
            }
        }
        .padding(12)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
        .onChange(of: viewModel.searchText) { _, _ in
            viewModel.scheduleSearchReload(api: appState.apiClient)
        }
    }

    private var filterMenus: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            filterMenu(
                title: "Month",
                selection: viewModel.selectedMonthLabel,
                options: viewModel.monthOptions
            ) { option in
                viewModel.selectedMonth = option.monthValue
                Task { await viewModel.reload(api: appState.apiClient) }
            }

            filterMenu(
                title: "Categorization",
                selection: viewModel.selectedCategorizationLabel,
                options: viewModel.categorizationOptions
            ) { option in
                if let status = CategorizationStatus(rawValue: option.id) {
                    viewModel.categorizationStatus = status
                    viewModel.filter = .expense
                    viewModel.selectedCategory = nil
                } else {
                    viewModel.categorizationStatus = nil
                }
                Task { await viewModel.reload(api: appState.apiClient) }
            }

            filterMenu(
                title: "Account",
                selection: viewModel.selectedAccountLabel,
                options: viewModel.accountOptions
            ) { option in
                viewModel.selectedAccountId = option.id.nilIfEmpty
                Task { await viewModel.reload(api: appState.apiClient) }
            }

            filterMenu(
                title: "Category",
                selection: viewModel.selectedCategoryLabel,
                options: viewModel.categoryOptions
            ) { option in
                viewModel.selectedCategory = option.id.nilIfEmpty
                viewModel.categorizationStatus = nil
                Task { await viewModel.reload(api: appState.apiClient) }
            }

            sortMenu
        }
    }

    private func filterMenu(
        title: String,
        selection: String,
        options: [TransactionsViewModel.FilterOption],
        onSelect: @escaping (TransactionsViewModel.FilterOption) -> Void
    ) -> some View {
        Menu {
            ForEach(options) { option in
                Button(option.label) { onSelect(option) }
            }
        } label: {
            filterMenuLabel(title: title, value: selection)
        }
    }

    private var sortMenu: some View {
        Menu {
            ForEach(TransactionSort.allCases, id: \.self) { sort in
                Button(sort.label) {
                    viewModel.sort = sort
                    Task { await viewModel.reload(api: appState.apiClient) }
                }
            }
        } label: {
            filterMenuLabel(title: "Sort", value: viewModel.sort.label)
        }
    }

    private func filterMenuLabel(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(SpendFlowTheme.textMuted)
            HStack {
                Text(value)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.text)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var transactionsContent: some View {
        if viewModel.isLoading, viewModel.transactions.isEmpty {
            LoadingStateView(message: "Fetching transactions…")
        } else if let error = viewModel.errorMessage, viewModel.transactions.isEmpty {
            ErrorStateView(message: error) {
                Task { await viewModel.reload(api: appState.apiClient) }
            }
        } else if viewModel.transactions.isEmpty {
            ContentUnavailableView(
                viewModel.categorizationStatus == nil ? "No transactions" : "All caught up",
                systemImage: "tray",
                description: Text(
                    viewModel.categorizationStatus == nil
                        ? "Try changing your filters"
                        : "Nothing left to review — you're all caught up"
                )
            )
            .frame(minHeight: 220)
        } else {
            LazyVStack(spacing: 10) {
                ForEach(viewModel.transactions) { transaction in
                    Button {
                        guard transaction.canEditCategory else { return }
                        viewModel.editingTransaction = transaction
                    } label: {
                        TransactionRow(transaction: transaction)
                    }
                    .buttonStyle(.plain)
                    .disabled(!transaction.canEditCategory)
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
}

struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 14) {
            CategoryChip(color: CategoryColor.forCategory(transaction.category))

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(transaction.merchantName ?? transaction.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.text)
                        .lineLimit(1)
                    if let memberName = transaction.memberName {
                        Text(memberName)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                (transaction.memberColor.map { Color(hex: $0) } ?? SpendFlowTheme.primary),
                                in: Capsule()
                            )
                    }
                    if transaction.pending {
                        Text("Pending")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(SpendFlowTheme.warning)
                    }
                }
                Text("\(transaction.category)\(transaction.subCategory.map { " · \($0)" } ?? "") · \(formattedDate)")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .lineLimit(1)
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

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

private extension Transaction {
    var canEditCategory: Bool {
        !isTransfer && transactionType != .transfer
    }
}

@MainActor
@Observable
final class TransactionsViewModel {
    var transactions: [Transaction] = []
    var isLoading = false
    var isLoadingMore = false
    var errorMessage: String?
    var feedbackMessage: String?
    var filter: TransactionTypeFilter = .all
    var searchText = ""
    var selectedMonth: String?
    var selectedAccountId: String?
    var selectedCategory: String?
    var categorizationStatus: CategorizationStatus?
    var selectedMemberId: String?
    var scope: ViewScope = .all
    var sort: TransactionSort = .dateDesc
    var editingTransaction: Transaction?

    var householdMembers: [HouseholdMember] = []
    private var accounts: [Account] = []
    private var categoryNames: [String] = []
    private var nextCursor: String?
    private var searchTask: Task<Void, Never>?

    struct FilterOption: Identifiable, Hashable {
        let id: String
        let label: String
        var monthValue: String? {
            id.isEmpty ? nil : id
        }
    }

    enum ScopeFilter: String, CaseIterable, Identifiable {
        case all
        case household
        case personal

        var id: String { rawValue }

        var viewScope: ViewScope {
            ViewScope(rawValue: rawValue) ?? .all
        }

        init(viewScope: ViewScope) {
            self = ScopeFilter(rawValue: viewScope.rawValue) ?? .all
        }

        var label: String {
            switch self {
            case .all: "Everything"
            case .household: "Family"
            case .personal: "Mine"
            }
        }
    }

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

    var monthOptions: [FilterOption] {
        var options = [FilterOption(id: "", label: "All months")]
        options.append(contentsOf: Self.recentMonths(count: 24).map { month in
            FilterOption(id: month, label: Self.monthLabel(month))
        })
        return options
    }

    var accountOptions: [FilterOption] {
        var options = [FilterOption(id: "", label: "All accounts")]
        options.append(contentsOf: accounts.map { account in
            let mask = account.mask.map { " •\($0)" } ?? ""
            return FilterOption(id: account.id, label: "\(account.name)\(mask)")
        })
        return options
    }

    var categoryOptions: [FilterOption] {
        var options = [FilterOption(id: "", label: "All categories")]
        let names = categoryNames.isEmpty ? SpendCategories.all : categoryNames
        options.append(contentsOf: names.map { FilterOption(id: $0, label: $0) })
        return options
    }

    var selectedMonthLabel: String {
        monthOptions.first(where: { $0.monthValue == selectedMonth })?.label ?? "All months"
    }

    var selectedAccountLabel: String {
        accountOptions.first(where: { $0.id == (selectedAccountId ?? "") })?.label ?? "All accounts"
    }

    var selectedCategoryLabel: String {
        categoryOptions.first(where: { $0.id == (selectedCategory ?? "") })?.label ?? "All categories"
    }

    var categorizationOptions: [FilterOption] {
        [FilterOption(id: "", label: "All transactions")]
            + CategorizationStatus.allCases.map { FilterOption(id: $0.rawValue, label: $0.label) }
    }

    var selectedCategorizationLabel: String {
        categorizationOptions.first(where: { $0.id == (categorizationStatus?.rawValue ?? "") })?.label
            ?? "All transactions"
    }

    func loadMetadata(api: APIClient) async {
        async let accountsTask = api.getAccounts()
        async let categoriesTask = api.getCategories()
        async let householdTask: HouseholdResponse? = {
            do {
                return try await api.getHousehold()
            } catch {
                return nil
            }
        }()

        do {
            let accountsResponse = try await accountsTask
            accounts = accountsResponse.accounts
        } catch {
            // Non-fatal — account filter stays empty.
        }

        do {
            let categoriesResponse = try await categoriesTask
            categoryNames = categoriesResponse.categories.map(\.name)
        } catch {
            categoryNames = SpendCategories.all
        }

        if let household = await householdTask {
            householdMembers = household.members
        }
    }

    func scheduleSearchReload(api: APIClient) {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await reload(api: api)
        }
    }

    func reload(api: APIClient) async {
        await load(api: api, reset: true)
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

        do {
            let response = try await api.getTransactions(filters: buildFilters(cursor: reset ? nil : nextCursor))
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

    func saveCategory(
        transaction: Transaction,
        category: String,
        subCategory: String?,
        rememberForMerchant: Bool,
        api: APIClient,
        refresh: FinancialRefreshCenter
    ) async throws {
        let result = try await api.updateTransactionCategory(
            transactionId: transaction.id,
            category: category,
            subCategory: subCategory,
            rememberForMerchant: rememberForMerchant
        )

        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            let existing = transactions[index]
            transactions[index] = Transaction(
                id: existing.id,
                accountId: existing.accountId,
                accountMask: existing.accountMask,
                date: existing.date,
                name: existing.name,
                merchantName: existing.merchantName,
                amount: existing.amount,
                currencyCode: existing.currencyCode,
                category: result.transaction.category,
                subCategory: result.transaction.subCategory,
                transactionType: existing.transactionType,
                isTransfer: existing.isTransfer,
                pending: existing.pending,
                memberId: existing.memberId,
                memberName: existing.memberName,
                memberColor: existing.memberColor
            )
        }

        let merchant = transaction.merchantName ?? transaction.name
        let label = subCategory.map { "\(category) → \($0)" } ?? category
        feedbackMessage = result.merchantTransactionsUpdated > 1
            ? "Updated \(result.merchantTransactionsUpdated) transactions for \(merchant) to \(label)."
            : "Saved \(label) for \(merchant) on future transactions."

        refresh.bump()
    }

    private func buildFilters(cursor: String? = nil) -> TransactionFilters {
        var filters = TransactionFilters()
        if let categorizationStatus {
            filters.type = .expense
            filters.categorizationStatus = categorizationStatus
        } else {
            filters.type = filter.transactionType
            filters.category = selectedCategory
        }
        filters.query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        filters.month = selectedMonth
        filters.accountId = selectedAccountId
        filters.memberId = selectedMemberId
        if selectedMemberId == nil {
            filters.scope = scope
        }
        filters.sort = sort
        filters.limit = 50
        filters.cursor = cursor
        return filters
    }

    private static func recentMonths(count: Int, now: Date = Date()) -> [String] {
        let calendar = Calendar.current
        let anchor = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
        return (0 ..< count).compactMap { offset in
            guard let date = calendar.date(byAdding: .month, value: -offset, to: anchor) else { return nil }
            let parts = calendar.dateComponents([.year, .month], from: date)
            guard let year = parts.year, let month = parts.month else { return nil }
            return String(format: "%04d-%02d", year, month)
        }
    }

    private static func monthLabel(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let year = Int(parts[0]), let monthNum = Int(parts[1]) else {
            return month
        }
        let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        guard monthNum >= 1, monthNum <= 12 else { return month }
        return "\(names[monthNum - 1]) \(year)"
    }
}
