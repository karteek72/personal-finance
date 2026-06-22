import SwiftUI

/// Scope / account / category / member dropdown filters — mirrors web `ChartFilterBar`.
struct AnalyticsFilterBar: View {
    let accounts: [Account]
    let categories: [String]
    var members: [HouseholdMember] = []

    @Binding var selectedAccountId: String
    @Binding var selectedCategory: String
    @Binding var selectedMemberId: String
    @Binding var scope: ViewScope

    var showScope = true
    var showMembers = true
    var showAccounts = true
    var showCategories = true
    var onClear: (() -> Void)?

    private var hasActiveFilters: Bool {
        !selectedAccountId.isEmpty || !selectedCategory.isEmpty || !selectedMemberId.isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                if showScope {
                    scopeMenu
                }

                if showMembers, !members.isEmpty {
                    memberMenu
                }

                if showAccounts {
                    accountMenu
                }

                if showCategories, !categories.isEmpty {
                    categoryMenu
                }
            }

            if hasActiveFilters, let onClear {
                Button("Clear filters", action: onClear)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.primary)
            }
        }
        .padding(14)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.5), lineWidth: 1)
        )
    }

    private var scopeMenu: some View {
        FilterMenuField(
            title: "View",
            selection: scopeLabel(scope),
            options: [
                FilterMenuOption(id: ViewScope.all.rawValue, label: "Everything"),
                FilterMenuOption(id: ViewScope.household.rawValue, label: "Family"),
                FilterMenuOption(id: ViewScope.personal.rawValue, label: "Mine"),
            ]
        ) { option in
            scope = ViewScope(rawValue: option.id) ?? .all
        }
    }

    private var memberMenu: some View {
        FilterMenuField(
            title: "Person",
            selection: selectedMemberLabel,
            options: memberOptions
        ) { option in
            selectedMemberId = option.id
        }
    }

    private var accountMenu: some View {
        FilterMenuField(
            title: "Account",
            selection: selectedAccountLabel,
            options: accountOptions
        ) { option in
            selectedAccountId = option.id
        }
    }

    private var categoryMenu: some View {
        FilterMenuField(
            title: "Category",
            selection: selectedCategory.isEmpty ? "All categories" : selectedCategory,
            options: categoryOptions
        ) { option in
            selectedCategory = option.id
        }
    }

    private var memberOptions: [FilterMenuOption] {
        [FilterMenuOption(id: "", label: "All people")]
            + members.map { FilterMenuOption(id: $0.id, label: $0.displayName) }
    }

    private var accountOptions: [FilterMenuOption] {
        [FilterMenuOption(id: "", label: "All accounts")]
            + accounts.map { account in
                let label = account.mask.map { "\(account.name) ••\($0)" } ?? account.name
                return FilterMenuOption(id: account.id, label: label)
            }
    }

    private var categoryOptions: [FilterMenuOption] {
        [FilterMenuOption(id: "", label: "All categories")]
            + categories.map { FilterMenuOption(id: $0, label: $0) }
    }

    private var selectedMemberLabel: String {
        memberOptions.first(where: { $0.id == selectedMemberId })?.label ?? "All people"
    }

    private var selectedAccountLabel: String {
        accountOptions.first(where: { $0.id == selectedAccountId })?.label ?? "All accounts"
    }

    private func scopeLabel(_ scope: ViewScope) -> String {
        switch scope {
        case .all: "Everything"
        case .household: "Family"
        case .personal: "Mine"
        }
    }
}
