import SwiftUI

@MainActor
@Observable
final class AccountsViewModel {
    var accounts: [Account] = []
    var isLoading = false
    var errorMessage: String?
    var statusMessage: String?
    var syncingAccountId: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.getAccounts()
            accounts = response.accounts
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sync(account: Account, api: APIClient) async {
        syncingAccountId = account.id
        statusMessage = nil
        defer { syncingAccountId = nil }

        do {
            _ = try await api.syncAccount(accountId: account.id)
            statusMessage = "Sync queued for \(account.name)"
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func beginPlaidLink(api: APIClient) async {
        statusMessage = nil
        do {
            let response = try await api.createPlaidLinkToken(platform: "ios")
            statusMessage =
                "Plaid Link iOS SDK required (Phase 2). Link token ready (\(response.linkToken.prefix(12))…)."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct AccountsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = AccountsViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let status = viewModel.statusMessage {
                        Text(status)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(SpendFlowColors.success)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button("Connect account") {
                        Task { await viewModel.beginPlaidLink(api: appState.apiClient) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(SpendFlowColors.primary)
                    .frame(maxWidth: .infinity)

                    if viewModel.isLoading, viewModel.accounts.isEmpty {
                        LoadingStateView(message: "Loading accounts…")
                    } else if let error = viewModel.errorMessage, viewModel.accounts.isEmpty {
                        ErrorStateView(message: error) {
                            Task { await viewModel.load(api: appState.apiClient) }
                        }
                    } else if viewModel.accounts.isEmpty {
                        SpendFlowCard {
                            Text("No accounts linked yet. Connect a bank to get started.")
                                .font(.subheadline)
                                .foregroundStyle(SpendFlowColors.textMuted)
                        }
                    } else {
                        ForEach(viewModel.accounts) { account in
                            accountCard(account)
                        }
                    }
                }
                .padding(20)
            }
            .background(SpendFlowColors.background)
            .navigationTitle("Accounts")
            .refreshable {
                await viewModel.load(api: appState.apiClient)
            }
            .task {
                await viewModel.load(api: appState.apiClient)
            }
        }
    }

    private func accountCard(_ account: Account) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(account.name)
                            .font(.headline)
                        Text(account.institutionName)
                            .font(.caption)
                            .foregroundStyle(SpendFlowColors.textMuted)
                    }
                    Spacer()
                    if let mask = account.mask {
                        Text("•••• \(mask)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(SpendFlowColors.textMuted)
                    }
                }

                MoneyText(amount: account.balanceCurrent, currencyCode: account.currencyCode)

                if account.status == .reauthRequired {
                    Text("Reconnection required")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SpendFlowColors.warning)
                }

                Button {
                    Task { await viewModel.sync(account: account, api: appState.apiClient) }
                } label: {
                    if viewModel.syncingAccountId == account.id {
                        ProgressView()
                    } else {
                        Text("Sync now")
                    }
                }
                .font(.caption.weight(.semibold))
                .disabled(viewModel.syncingAccountId == account.id)
            }
        }
    }
}
