import SwiftUI

/// Scope / account / category / member pickers — mirrors web `ChartFilterBar`.
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
            if showScope {
                filterRow(label: "View") {
                    scopePill("Family", scope: .household)
                    scopePill("Mine", scope: .personal)
                    scopePill("Everything", scope: .all)
                }
            }

            if showMembers, !members.isEmpty {
                filterRow(label: "Member") {
                    memberPill(id: "", label: "All")
                    ForEach(members) { member in
                        memberPill(id: member.id, label: member.displayName, color: Color(hex: member.avatarColor))
                    }
                }
            }

            if showAccounts {
                filterRow(label: "Account") {
                    accountPill(id: "", label: "All")
                    ForEach(accounts) { account in
                        let label = account.mask.map { "••\($0)" } ?? account.name
                        accountPill(id: account.id, label: label)
                    }
                }
            }

            if showCategories, !categories.isEmpty {
                filterRow(label: "Category") {
                    categoryPill(name: "")
                    ForEach(categories.prefix(8), id: \.self) { category in
                        categoryPill(name: category)
                    }
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

    private func filterRow<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
                .tracking(0.6)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    content()
                }
            }
        }
    }

    private func scopePill(_ label: String, scope value: ViewScope) -> some View {
        filterPill(label: label, isSelected: scope == value) {
            scope = value
        }
    }

    private func accountPill(id: String, label: String) -> some View {
        filterPill(label: label, isSelected: selectedAccountId == id) {
            selectedAccountId = selectedAccountId == id && !id.isEmpty ? "" : id
        }
    }

    private func categoryPill(name: String) -> some View {
        let label = name.isEmpty ? "All" : name
        return filterPill(label: label, isSelected: selectedCategory == name) {
            selectedCategory = selectedCategory == name && !name.isEmpty ? "" : name
        }
    }

    private func memberPill(id: String, label: String, color: Color? = nil) -> some View {
        filterPill(label: label, isSelected: selectedMemberId == id, dotColor: color) {
            selectedMemberId = selectedMemberId == id && !id.isEmpty ? "" : id
        }
    }

    private func filterPill(
        label: String,
        isSelected: Bool,
        dotColor: Color? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let dotColor {
                    Circle()
                        .fill(dotColor)
                        .frame(width: 8, height: 8)
                }
                Text(label)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
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
    }
}
