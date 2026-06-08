import SwiftUI

@MainActor
@Observable
final class AcceptInviteViewModel {
    var preview: HouseholdInvitePreview?
    var isLoading = false
    var isAccepting = false
    var errorMessage: String?
    var successMessage: String?

    func loadPreview(token: String, api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            preview = try await api.previewHouseholdInvite(token: token)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func accept(token: String, api: APIClient, refresh: FinancialRefreshCenter) async {
        isAccepting = true
        errorMessage = nil
        defer { isAccepting = false }

        do {
            let result = try await api.acceptHouseholdInvite(token: token)
            successMessage = "Joined \(result.householdName) as \(result.memberDisplayName)."
            refresh.bump()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct AcceptInviteView: View {
    @Environment(AppState.self) private var appState
    let token: String
    @State private var viewModel = AcceptInviteViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if viewModel.isLoading, viewModel.preview == nil {
                        LoadingStateView(message: "Loading invite…")
                    } else if let error = viewModel.errorMessage, viewModel.preview == nil {
                        ErrorStateView(message: error) {
                            Task { await viewModel.loadPreview(token: token, api: appState.apiClient) }
                        }
                    } else if let success = viewModel.successMessage {
                        GlassCard {
                            Label(success, systemImage: "checkmark.circle.fill")
                                .font(.subheadline)
                                .foregroundStyle(SpendFlowTheme.success)
                        }
                    } else if let preview = viewModel.preview {
                        invitePreview(preview)
                        acceptButton
                    }
                }
                .padding()
            }
            .navigationTitle("Household invite")
            .task {
                await viewModel.loadPreview(token: token, api: appState.apiClient)
            }
        }
    }

    private func invitePreview(_ preview: HouseholdInvitePreview) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("You're invited to join")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Text(preview.householdName)
                    .font(.title2.weight(.bold))
                Text("Invited by \(preview.memberName) · \(preview.memberRole)")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Text(preview.email)
                    .font(.caption.monospaced())
                Text("Expires \(preview.expiresAt)")
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
        }
    }

    private var acceptButton: some View {
        Group {
            if appState.authService.isAuthenticated {
                SpendFlowPrimaryButton(
                    title: "Accept invite",
                    isLoading: viewModel.isAccepting
                ) {
                    Task {
                        await viewModel.accept(
                            token: token,
                            api: appState.apiClient,
                            refresh: appState.refreshCenter
                        )
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Sign in to accept this invite.")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                    NavigationLink {
                        LoginView()
                    } label: {
                        Text("Sign in")
                            .font(.subheadline.weight(.bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(SpendFlowTheme.heroGradient, in: Capsule())
                            .foregroundStyle(.white)
                    }
                }
            }

            if let error = viewModel.errorMessage, viewModel.preview != nil {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.danger)
            }
        }
    }
}
