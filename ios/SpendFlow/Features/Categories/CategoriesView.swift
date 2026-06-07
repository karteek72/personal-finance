import SwiftUI

@MainActor
@Observable
final class CategoriesViewModel {
    var categories: [CategoryTotal] = []
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.getCategories()
            categories = response.categories.sorted { lhs, rhs in
                (Decimal(string: lhs.amount) ?? 0) > (Decimal(string: rhs.amount) ?? 0)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct CategoriesView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CategoriesViewModel()

    var body: some View {
        SpendFlowScreen(title: "Spend", subtitle: "Where your money actually goes") {
            if viewModel.isLoading, viewModel.categories.isEmpty {
                LoadingStateView(message: "Crunching categories…")
            } else if let error = viewModel.errorMessage, viewModel.categories.isEmpty {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(Array(viewModel.categories.enumerated()), id: \.element.id) { index, category in
                        CategoryRow(category: category, rank: index + 1)
                    }
                }
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }
}

private struct CategoryRow: View {
    let category: CategoryTotal
    let rank: Int

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
                .fill(SpendFlowTheme.surface)
        }
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
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
