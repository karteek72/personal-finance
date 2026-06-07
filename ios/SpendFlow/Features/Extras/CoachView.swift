import SwiftUI

@MainActor
@Observable
final class CoachViewModel {
    var data: CoachResponse?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getCoach()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct CoachView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CoachViewModel()

    var body: some View {
        SpendFlowScreen(title: "Coach", subtitle: "Guided insights from your data") {
            if viewModel.isLoading, viewModel.data == nil {
                LoadingStateView(message: "Loading coach…")
            } else if let error = viewModel.errorMessage, viewModel.data == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else if let data = viewModel.data {
                GlassCard {
                    Text(data.narrative).font(.subheadline)
                }
                GlassCard {
                    Text(data.forecast)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
                ForEach(data.qa) { item in
                    GlassCard {
                        Text(item.q).font(.caption.weight(.semibold))
                        Text(item.a).font(.caption)
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
