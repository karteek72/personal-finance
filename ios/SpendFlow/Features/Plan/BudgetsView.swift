import SwiftUI

@MainActor
@Observable
final class BudgetsViewModel {
    var data: BudgetsResponse?
    var isLoading = false
    var isMutating = false
    var errorMessage: String?

    var dismissedBudgetCategories: Set<String> {
        guard let budgets = data?.budgets else { return [] }
        return Set(budgets.filter { $0.source == .suggested && parseAmount($0.limit) == 0 }.map(\.category))
    }

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getBudgets()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func acceptBudgetSuggestion(_ item: BudgetItem, api: APIClient) async {
        guard let periodMonth = data?.periodMonth else { return }
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.upsertBudget(UpsertBudgetInput(
                category: item.category,
                periodMonth: periodMonth,
                limit: parseAmount(item.limit),
                emoji: item.emoji,
                color: item.color,
                source: .user,
                budgetClass: item.budgetClass
            ))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func dismissBudgetSuggestion(_ item: BudgetItem, api: APIClient) async {
        guard let periodMonth = data?.periodMonth else { return }
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.upsertBudget(UpsertBudgetInput(
                category: item.category,
                periodMonth: periodMonth,
                limit: 0,
                source: .suggested
            ))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteBudget(_ item: BudgetItem, api: APIClient) async {
        guard let id = item.storedId else { return }
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.deleteBudget(budgetId: id)
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func upsertBudget(category: String, limit: Double, api: APIClient) async {
        guard let periodMonth = data?.periodMonth else { return }
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.upsertBudget(UpsertBudgetInput(
                category: category,
                periodMonth: periodMonth,
                limit: limit,
                source: .user
            ))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func patchBudget(_ item: BudgetItem, limit: Double, api: APIClient) async {
        guard let id = item.storedId else { return }
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.patchBudget(budgetId: id, patch: PatchBudgetInput(limit: limit))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func acceptGoalSuggestion(_ item: GoalItem, api: APIClient) async {
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.createGoal(CreateGoalInput(
                name: item.name,
                target: parseAmount(item.target),
                current: parseAmount(item.current),
                deadline: item.deadline,
                emoji: item.emoji,
                color: item.color,
                kind: item.kind,
                status: .active,
                source: .user,
                accountId: item.accountId
            ))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func dismissGoalSuggestion(_ item: GoalItem, api: APIClient) async {
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.createGoal(CreateGoalInput(
                name: item.name,
                target: parseAmount(item.target),
                current: parseAmount(item.current),
                deadline: item.deadline,
                emoji: item.emoji,
                color: item.color,
                kind: item.kind,
                status: .dismissed,
                source: .suggested,
                accountId: item.accountId
            ))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteGoal(_ item: GoalItem, api: APIClient) async {
        guard let id = item.storedId else { return }
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.deleteGoal(goalId: id)
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createGoal(name: String, target: Double, current: Double, api: APIClient) async {
        isMutating = true
        defer { isMutating = false }

        do {
            _ = try await api.createGoal(CreateGoalInput(
                name: name,
                target: target,
                current: current,
                source: .user
            ))
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func parseAmount(_ amount: String) -> Double {
        guard let decimal = Decimal(string: amount) else { return 0 }
        return NSDecimalNumber(decimal: decimal).doubleValue
    }
}

struct BudgetsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = BudgetsViewModel()
    @State private var showBudgetForm = false
    @State private var showGoalForm = false
    @State private var editingBudget: BudgetItem?
    @State private var budgetCategory = ""
    @State private var budgetLimit = ""
    @State private var goalName = ""
    @State private var goalTarget = ""
    @State private var goalCurrent = ""

    var body: some View {
        SpendFlowScreen(title: "Budgets & Goals", subtitle: "Monthly plan and savings targets") {
            content
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
        .sheet(isPresented: $showBudgetForm) {
            budgetFormSheet
        }
        .sheet(isPresented: $showGoalForm) {
            goalFormSheet
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading, viewModel.data == nil {
            LoadingStateView(message: "Loading your plan…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            safeToSpendHeader(data: data)
            actionButtons
            budgetSuggestions(data: data)
            budgetsSection(data: data)
            goalSuggestions(data: data)
            goalsSection(data: data)
        }
    }

    private func safeToSpendHeader(data: BudgetsResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Safe to spend")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.85))
            MoneyText(
                amount: data.safeToSpend,
                font: .system(size: 36, weight: .heavy).monospacedDigit()
            )
            .foregroundStyle(.white)
            HStack {
                Text(data.periodMonth)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.8))
                Spacer()
                Text("\(data.daysRemaining) days left")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.9))
            }
        }
        .padding(22)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(SpendFlowTheme.heroGradient)
        }
    }

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button("Add budget") {
                editingBudget = nil
                budgetCategory = ""
                budgetLimit = ""
                showBudgetForm = true
            }
            .font(.caption.weight(.bold))
            .buttonStyle(.borderedProminent)

            Button("Add goal") {
                goalName = ""
                goalTarget = ""
                goalCurrent = "0"
                showGoalForm = true
            }
            .font(.caption.weight(.bold))
            .buttonStyle(.bordered)
        }
    }

    private func budgetSuggestions(data: BudgetsResponse) -> some View {
        let visible = data.suggestedBudgets.filter { !viewModel.dismissedBudgetCategories.contains($0.category) }
        return Group {
            if !visible.isEmpty {
                suggestionsSection(title: "Suggested budgets") {
                    ForEach(visible) { item in
                        suggestionRow(
                            title: "\(item.emoji ?? "💸") \(item.category)",
                            amount: item.limit,
                            rationale: item.rationale,
                            onAccept: {
                                Task { await viewModel.acceptBudgetSuggestion(item, api: appState.apiClient) }
                            },
                            onDismiss: {
                                Task { await viewModel.dismissBudgetSuggestion(item, api: appState.apiClient) }
                            }
                        )
                    }
                }
            }
        }
    }

    private func budgetsSection(data: BudgetsResponse) -> some View {
        let active = data.budgets.filter { budget in
            !(budget.source == .suggested && parseAmount(budget.limit) == 0)
        }
        return section(title: "Budgets", items: active) { budget in
            budgetRow(budget)
        }
    }

    private func budgetRow(_ budget: BudgetItem) -> some View {
        let spent = parseAmount(budget.spent)
        let limit = parseAmount(budget.limit)
        let progress = limit > 0 ? min(spent / limit, 1) : 0

        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(budget.emoji ?? "📊") \(budget.category)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                MoneyText(amount: budget.spent, font: .caption.weight(.bold))
                Text("/")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                MoneyText(amount: budget.limit, font: .caption.weight(.bold))
            }
            ProgressView(value: progress)
                .tint(progress > 0.9 ? SpendFlowTheme.danger : SpendFlowTheme.primary)
            HStack {
                Button("Edit") {
                    editingBudget = budget
                    budgetCategory = budget.category
                    budgetLimit = String(format: "%.0f", limit)
                    showBudgetForm = true
                }
                .font(.caption2.weight(.semibold))
                if budget.storedId != nil {
                    Button("Delete", role: .destructive) {
                        Task { await viewModel.deleteBudget(budget, api: appState.apiClient) }
                    }
                    .font(.caption2.weight(.semibold))
                }
            }
        }
        .padding(14)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
    }

    private func goalSuggestions(data: BudgetsResponse) -> some View {
        Group {
            if !data.suggestedGoals.isEmpty {
                suggestionsSection(title: "Suggested goals") {
                    ForEach(data.suggestedGoals) { item in
                        suggestionRow(
                            title: "\(item.emoji ?? "🎯") \(item.name)",
                            amount: item.target,
                            rationale: item.rationale,
                            onAccept: {
                                Task { await viewModel.acceptGoalSuggestion(item, api: appState.apiClient) }
                            },
                            onDismiss: {
                                Task { await viewModel.dismissGoalSuggestion(item, api: appState.apiClient) }
                            }
                        )
                    }
                }
            }
        }
    }

    private func goalsSection(data: BudgetsResponse) -> some View {
        let active = data.goals.filter { $0.status == .active }
        return section(title: "Goals", items: active) { goal in
            goalRow(goal)
        }
    }

    private func goalRow(_ goal: GoalItem) -> some View {
        let current = parseAmount(goal.current)
        let target = parseAmount(goal.target)
        let progress = target > 0 ? min(current / target, 1) : 0

        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(goal.emoji ?? "🎯") \(goal.name)")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                MoneyText(amount: goal.current, font: .caption.weight(.bold))
                Text("/")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                MoneyText(amount: goal.target, font: .caption.weight(.bold))
            }
            ProgressView(value: progress)
                .tint(SpendFlowTheme.success)
            if goal.storedId != nil {
                Button("Delete", role: .destructive) {
                    Task { await viewModel.deleteGoal(goal, api: appState.apiClient) }
                }
                .font(.caption2.weight(.semibold))
            }
        }
        .padding(14)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
        )
    }

    private func suggestionsSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline.weight(.bold))
            content()
        }
    }

    private func suggestionRow(
        title: String,
        amount: String,
        rationale: String?,
        onAccept: @escaping () -> Void,
        onDismiss: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                MoneyText(amount: amount, font: .caption.weight(.bold))
            }
            if let rationale {
                Text(rationale)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
            HStack(spacing: 10) {
                Button("Accept", action: onAccept)
                    .font(.caption.weight(.bold))
                    .buttonStyle(.borderedProminent)
                    .disabled(viewModel.isMutating)
                Button("Dismiss", action: onDismiss)
                    .font(.caption.weight(.semibold))
                    .buttonStyle(.bordered)
                    .disabled(viewModel.isMutating)
            }
        }
        .padding(14)
        .background(SpendFlowTheme.primarySoft.opacity(0.35), in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.primary.opacity(0.3), lineWidth: 1)
        )
    }

    private func section<Item: Identifiable, Row: View>(
        title: String,
        items: [Item],
        @ViewBuilder row: @escaping (Item) -> Row
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline.weight(.bold))
            if items.isEmpty {
                Text("Nothing here yet")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            } else {
                ForEach(items) { item in
                    row(item)
                }
            }
        }
    }

    private var budgetFormSheet: some View {
        NavigationStack {
            Form {
                TextField("Category", text: $budgetCategory)
                    .disabled(editingBudget != nil)
                TextField("Monthly limit", text: $budgetLimit)
                    .keyboardType(.decimalPad)
            }
            .navigationTitle(editingBudget == nil ? "Add budget" : "Edit budget")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showBudgetForm = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let limit = Double(budgetLimit), limit >= 0 else { return }
                        Task {
                            if let editing = editingBudget {
                                await viewModel.patchBudget(editing, limit: limit, api: appState.apiClient)
                            } else {
                                await viewModel.upsertBudget(
                                    category: budgetCategory.trimmingCharacters(in: .whitespaces),
                                    limit: limit,
                                    api: appState.apiClient
                                )
                            }
                            showBudgetForm = false
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private var goalFormSheet: some View {
        NavigationStack {
            Form {
                TextField("Goal name", text: $goalName)
                TextField("Target amount", text: $goalTarget)
                    .keyboardType(.decimalPad)
                TextField("Current saved", text: $goalCurrent)
                    .keyboardType(.decimalPad)
            }
            .navigationTitle("Add goal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showGoalForm = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let target = Double(goalTarget), let current = Double(goalCurrent) else { return }
                        Task {
                            await viewModel.createGoal(
                                name: goalName.trimmingCharacters(in: .whitespaces),
                                target: target,
                                current: current,
                                api: appState.apiClient
                            )
                            showGoalForm = false
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func parseAmount(_ amount: String) -> Double {
        guard let decimal = Decimal(string: amount) else { return 0 }
        return NSDecimalNumber(decimal: decimal).doubleValue
    }
}
