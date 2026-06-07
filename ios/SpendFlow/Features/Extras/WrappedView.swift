import SwiftUI

@MainActor
@Observable
final class WrappedViewModel {
    var data: WrappedResponse?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getWrapped()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct WrappedView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = WrappedViewModel()

    var body: some View {
        SpendFlowScreen(title: "Wrapped", subtitle: "Your year in review") {
            if viewModel.isLoading, viewModel.data == nil {
                LoadingStateView(message: "Loading wrapped…")
            } else if let error = viewModel.errorMessage, viewModel.data == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else if let data = viewModel.data {
                Text("Year \(data.year)")
                    .font(.title2.bold())
                MoneyText(amount: data.totalSpent, font: .headline)
                Text("\(data.transactionCount) transactions · \(Int(data.savingsRate * 100))% savings rate")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                ForEach(data.moments) { moment in
                    GlassCard {
                        Text(moment.label).font(.caption.weight(.semibold))
                        Text(moment.value).font(.subheadline)
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
