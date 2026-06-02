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
        NavigationStack {
            Group {
                if viewModel.isLoading, viewModel.categories.isEmpty {
                    LoadingStateView(message: "Loading categories…")
                } else if let error = viewModel.errorMessage, viewModel.categories.isEmpty {
                    ErrorStateView(message: error) {
                        Task { await viewModel.load(api: appState.apiClient) }
                    }
                } else {
                    List(viewModel.categories) { category in
                        HStack(spacing: 12) {
                            Circle()
                                .fill(CategoryColor.forCategory(category.name))
                                .frame(width: 10, height: 10)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(category.name)
                                    .font(.subheadline.weight(.semibold))
                                Text("\(Int(category.percentage.rounded()))% of spend")
                                    .font(.caption)
                                    .foregroundStyle(SpendFlowColors.textMuted)
                            }

                            Spacer()

                            MoneyText(amount: category.amount, font: .subheadline)
                        }
                        .listRowBackground(SpendFlowColors.surface)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(SpendFlowColors.background)
            .navigationTitle("Categories")
            .refreshable {
                await viewModel.load(api: appState.apiClient)
            }
            .task {
                await viewModel.load(api: appState.apiClient)
            }
        }
    }
}
