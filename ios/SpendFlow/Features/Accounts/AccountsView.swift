import SwiftUI

@MainActor
@Observable
final class AccountsViewModel {
    var accounts: [Account] = []
    var isLoading = false
    var errorMessage: String?
    var statusMessage: String?
    var syncingAccountId: String?
    var deletingAccountId: String?
    var isSyncingAll = false
    var tellerStatusMessage: String?

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
            statusMessage = "Synced \(account.name) ✓"
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func syncAllPlaid(api: APIClient) async {
        isSyncingAll = true
        statusMessage = nil
        defer { isSyncingAll = false }

        do {
            let result = try await api.syncAllPlaidItems()
            statusMessage = result.message
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delete(account: Account, api: APIClient) async {
        deletingAccountId = account.id
        defer { deletingAccountId = nil }

        do {
            _ = try await api.deleteAccount(accountId: account.id)
            statusMessage = "Removed \(account.name)"
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func checkTellerAvailability(api: APIClient) async {
        do {
            _ = try await api.getTellerConfig()
            tellerStatusMessage = "Teller Connect is configured. Native enrollment UI coming soon — use the web app to link via Teller for now."
        } catch {
            tellerStatusMessage = "Teller Connect is not available in this environment."
        }
    }
}

struct AccountsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = AccountsViewModel()
    @State private var accountToDelete: Account?

    private let cardGradients: [LinearGradient] = [
        LinearGradient(colors: [Color(hex: "#7C3AED"), Color(hex: "#A855F7")], startPoint: .topLeading, endPoint: .bottomTrailing),
        LinearGradient(colors: [Color(hex: "#6366F1"), Color(hex: "#818CF8")], startPoint: .topLeading, endPoint: .bottomTrailing),
        LinearGradient(colors: [Color(hex: "#EC4899"), Color(hex: "#F472B6")], startPoint: .topLeading, endPoint: .bottomTrailing),
        LinearGradient(colors: [Color(hex: "#14B8A6"), Color(hex: "#2DD4BF")], startPoint: .topLeading, endPoint: .bottomTrailing),
    ]

    var body: some View {
        NavigationStack {
            walletContent
        }
        .confirmationDialog(
            "Delete this account?",
            isPresented: Binding(
                get: { accountToDelete != nil },
                set: { if !$0 { accountToDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let account = accountToDelete {
                Button("Delete \(account.name)", role: .destructive) {
                    Task { await viewModel.delete(account: account, api: appState.apiClient) }
                }
            }
            Button("Cancel", role: .cancel) { accountToDelete = nil }
        } message: {
            Text("Transactions for this account will be removed from SpendFlow.")
        }
    }

    private var walletContent: some View {
        SpendFlowScreen(title: "Wallet", subtitle: "Accounts & balances in one place") {
            if let status = viewModel.statusMessage ?? appState.plaidLink.statusMessage ?? appState.snapTradeLink.statusMessage {
                statusBanner(status, isSuccess: true)
            }
            if let tellerStatus = viewModel.tellerStatusMessage {
                statusBanner(tellerStatus, isSuccess: true)
            }
            if let error = viewModel.errorMessage ?? appState.plaidLink.errorMessage ?? appState.snapTradeLink.errorMessage {
                statusBanner(error, isSuccess: false)
            }

            SpendFlowPrimaryButton(
                title: "Link a bank",
                isLoading: appState.plaidLink.isLoading
            ) {
                Task {
                    await appState.plaidLink.startLink {
                        appState.refreshCenter.bump()
                        await viewModel.load(api: appState.apiClient)
                    }
                }
            }

            SpendFlowPrimaryButton(
                title: "Link brokerage (SnapTrade)",
                isLoading: appState.snapTradeLink.isLoading
            ) {
                Task {
                    await appState.snapTradeLink.startLink {
                        appState.refreshCenter.bump()
                        await viewModel.load(api: appState.apiClient)
                    }
                }
            }

            Button {
                Task { await viewModel.checkTellerAvailability(api: appState.apiClient) }
            } label: {
                Text("Connect with Teller")
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(SpendFlowTheme.surface, in: Capsule())
                    .overlay(Capsule().stroke(SpendFlowTheme.border, lineWidth: 1))
            }
            .buttonStyle(.plain)

            if !viewModel.accounts.isEmpty {
                SpendFlowPrimaryButton(
                    title: "Sync all Plaid accounts",
                    isLoading: viewModel.isSyncingAll
                ) {
                    Task { await viewModel.syncAllPlaid(api: appState.apiClient) }
                }
            }

            if viewModel.isLoading, viewModel.accounts.isEmpty {
                LoadingStateView(message: "Loading accounts…")
            } else if let error = viewModel.errorMessage, viewModel.accounts.isEmpty {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else if viewModel.accounts.isEmpty {
                GlassCard {
                    VStack(spacing: 8) {
                        Text("No accounts yet")
                            .font(.headline.weight(.bold))
                        Text("Link your first bank and we'll handle the boring stuff.")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                }
            } else {
                LazyVStack(spacing: 14) {
                    ForEach(Array(viewModel.accounts.enumerated()), id: \.element.id) { index, account in
                        accountCard(account, gradient: cardGradients[index % cardGradients.count])
                    }
                }
            }
        }
        .spendFlowPlaidLink(coordinator: appState.plaidLink)
        .spendFlowSnapTradeLink(coordinator: appState.snapTradeLink)
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    private func statusBanner(_ text: String, isSuccess: Bool) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(isSuccess ? SpendFlowTheme.success : SpendFlowTheme.danger)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func accountCard(_ account: Account, gradient: LinearGradient) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.name)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)
                    Text(account.institutionName)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.8))
                }
                Spacer()
                if let mask = account.mask {
                    Text("•••• \(mask)")
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.white.opacity(0.85))
                }
            }

            MoneyText(
                amount: account.balanceCurrent,
                currencyCode: account.currencyCode,
                font: .title2.weight(.bold)
            )
            .foregroundStyle(.white)

            if account.status == .reauthRequired {
                Button {
                    Task {
                        await appState.plaidLink.startLink(itemId: account.plaidItemId) {
                            appState.refreshCenter.bump()
                            await viewModel.load(api: appState.apiClient)
                        }
                    }
                } label: {
                    Text("Reconnect bank ⚠️")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.white.opacity(0.25))
                        .clipShape(Capsule())
                        .foregroundStyle(.white)
                }
            }

            HStack(spacing: 8) {
                Button {
                    Task { await viewModel.sync(account: account, api: appState.apiClient) }
                } label: {
                    HStack {
                        if viewModel.syncingAccountId == account.id {
                            ProgressView().tint(.white)
                        } else {
                            Text("Sync now")
                                .font(.caption.weight(.bold))
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.white.opacity(0.2))
                    .clipShape(Capsule())
                    .foregroundStyle(.white)
                }
                .disabled(viewModel.syncingAccountId == account.id)

                Button {
                    accountToDelete = account
                } label: {
                    Text(viewModel.deletingAccountId == account.id ? "…" : "Delete")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.white.opacity(0.15))
                        .clipShape(Capsule())
                        .foregroundStyle(.white.opacity(0.95))
                }
                .disabled(viewModel.deletingAccountId == account.id)
            }
        }
        .padding(20)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(gradient)
        }
        .shadow(color: SpendFlowTheme.primary.opacity(0.2), radius: 14, x: 0, y: 8)
    }
}
