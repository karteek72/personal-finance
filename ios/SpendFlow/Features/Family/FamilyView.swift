import SwiftUI

@MainActor
@Observable
final class FamilyViewModel {
    var household: HouseholdResponse?
    var insights: HouseholdInsightsResponse?
    var isLoading = false
    var errorMessage: String?
    var statusMessage: String?
    var busyId: String?

    func load(api: APIClient) async {
        isLoading = household == nil
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let householdTask = api.getHousehold()
            async let insightsTask = api.getHouseholdInsights()
            household = try await householdTask
            insights = try await insightsTask
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createMember(name: String, role: HouseholdMemberRole, api: APIClient, refresh: FinancialRefreshCenter) async {
        busyId = "new"
        defer { busyId = nil }
        do {
            _ = try await api.createHouseholdMember(displayName: name, role: role)
            refresh.bump()
            await load(api: api)
            statusMessage = "Member added."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateMember(
        memberId: String,
        displayName: String?,
        role: HouseholdMemberRole?,
        api: APIClient,
        refresh: FinancialRefreshCenter
    ) async {
        busyId = memberId
        defer { busyId = nil }
        do {
            _ = try await api.updateHouseholdMember(memberId: memberId, displayName: displayName, role: role)
            refresh.bump()
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteMember(memberId: String, api: APIClient, refresh: FinancialRefreshCenter) async {
        busyId = memberId
        defer { busyId = nil }
        do {
            _ = try await api.deleteHouseholdMember(memberId: memberId)
            refresh.bump()
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func assignAccount(accountId: String, memberId: String, api: APIClient, refresh: FinancialRefreshCenter) async {
        busyId = accountId
        defer { busyId = nil }
        do {
            _ = try await api.assignAccountToMember(accountId: accountId, memberId: memberId)
            refresh.bump()
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func renameHousehold(name: String, api: APIClient, refresh: FinancialRefreshCenter) async {
        do {
            _ = try await api.updateHouseholdName(name)
            refresh.bump()
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func inviteMember(memberId: String, email: String, api: APIClient, refresh: FinancialRefreshCenter) async {
        busyId = "invite-\(memberId)"
        defer { busyId = nil }
        do {
            let result = try await api.inviteHouseholdMember(memberId: memberId, email: email)
            refresh.bump()
            await load(api: api)
            statusMessage = "Invite sent to \(result.email)."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func revokeInvite(memberId: String, api: APIClient, refresh: FinancialRefreshCenter) async {
        busyId = "revoke-\(memberId)"
        defer { busyId = nil }
        do {
            _ = try await api.revokeHouseholdInvite(memberId: memberId)
            refresh.bump()
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct FamilyView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = FamilyViewModel()
    @State private var newMemberName = ""
    @State private var newMemberRole: HouseholdMemberRole = .partner
    @State private var editingHouseholdName = false
    @State private var householdNameDraft = ""
    @State private var inviteEmails: [String: String] = [:]

    private var isOwner: Bool {
        viewModel.household?.accessRole == "owner"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let status = viewModel.statusMessage {
                    Text(status)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.success)
                }
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.danger)
                }

                if viewModel.isLoading, viewModel.household == nil {
                    LoadingStateView(message: "Loading family…")
                } else if let data = viewModel.household {
                    householdHeader(data)
                    if let insights = viewModel.insights {
                        insightsTotals(insights)
                    }
                    membersSection(data)
                    accountsSection(data)
                    if isOwner {
                        addMemberSection
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Family")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    @ViewBuilder
    private func householdHeader(_ data: HouseholdResponse) -> some View {
        GlassCard {
            if editingHouseholdName, isOwner {
                HStack {
                    TextField("Household name", text: $householdNameDraft)
                        .textFieldStyle(.roundedBorder)
                    Button("Save") {
                        Task {
                            await viewModel.renameHousehold(
                                name: householdNameDraft,
                                api: appState.apiClient,
                                refresh: appState.refreshCenter
                            )
                            editingHouseholdName = false
                        }
                    }
                }
            } else {
                HStack {
                    VStack(alignment: .leading) {
                        Text(data.household.name)
                            .font(.title3.bold())
                        Text("\(data.members.count) members · \(data.accounts.count) accounts")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                    Spacer()
                    if isOwner {
                        Button("Rename") {
                            householdNameDraft = data.household.name
                            editingHouseholdName = true
                        }
                        .font(.caption.weight(.semibold))
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func insightsTotals(_ insights: HouseholdInsightsResponse) -> some View {
        HStack(spacing: 10) {
            kpiTile("Spent", amount: insights.householdTotals.expenses)
            kpiTile("Income", amount: insights.householdTotals.income)
            kpiTile("Net", amount: insights.householdTotals.net)
        }
    }

    private func kpiTile(_ label: String, amount: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(SpendFlowTheme.textMuted)
            MoneyText(amount: amount, font: .subheadline.bold())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
    }

    @ViewBuilder
    private func membersSection(_ data: HouseholdResponse) -> some View {
        Text("Members")
            .font(.headline)
        ForEach(data.members) { member in
            GlassCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Circle()
                            .fill(Color(hex: member.avatarColor))
                            .frame(width: 12, height: 12)
                        Text(member.displayName)
                            .font(.subheadline.weight(.semibold))
                        Text(member.role.rawValue.capitalized)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                        Spacer()
                        if member.userId != nil {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundStyle(SpendFlowTheme.success)
                                .font(.caption)
                        }
                    }

                    if let invite = member.pendingInvite {
                        Text("Pending invite to \(invite.email)")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.warning)
                        if isOwner {
                            Button("Revoke invite", role: .destructive) {
                                Task {
                                    await viewModel.revokeInvite(
                                        memberId: member.id,
                                        api: appState.apiClient,
                                        refresh: appState.refreshCenter
                                    )
                                }
                            }
                            .font(.caption)
                        }
                    } else if isOwner, member.userId == nil, member.role != .owner {
                        HStack {
                            TextField("Email to invite", text: Binding(
                                get: { inviteEmails[member.id, default: ""] },
                                set: { inviteEmails[member.id] = $0 }
                            ))
                            .textFieldStyle(.roundedBorder)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            Button("Invite") {
                                let email = inviteEmails[member.id, default: ""]
                                Task {
                                    await viewModel.inviteMember(
                                        memberId: member.id,
                                        email: email,
                                        api: appState.apiClient,
                                        refresh: appState.refreshCenter
                                    )
                                }
                            }
                            .disabled(viewModel.busyId == "invite-\(member.id)")
                        }
                    }

                    if isOwner, member.role != .owner {
                        Button("Remove member", role: .destructive) {
                            Task {
                                await viewModel.deleteMember(
                                    memberId: member.id,
                                    api: appState.apiClient,
                                    refresh: appState.refreshCenter
                                )
                            }
                        }
                        .font(.caption)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func accountsSection(_ data: HouseholdResponse) -> some View {
        Text("Accounts")
            .font(.headline)
        ForEach(data.accounts) { account in
            GlassCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text(account.name)
                        .font(.subheadline.weight(.semibold))
                    Text(account.institutionName)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                    if let memberName = account.memberName {
                        Text("Assigned to \(memberName)")
                            .font(.caption)
                    } else {
                        Text("Unassigned")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.warning)
                    }
                    if isOwner {
                        Picker("Assign to", selection: Binding(
                            get: { account.memberId ?? "" },
                            set: { memberId in
                                guard !memberId.isEmpty else { return }
                                Task {
                                    await viewModel.assignAccount(
                                        accountId: account.accountId,
                                        memberId: memberId,
                                        api: appState.apiClient,
                                        refresh: appState.refreshCenter
                                    )
                                }
                            }
                        )) {
                            Text("Unassigned").tag("")
                            ForEach(data.members) { member in
                                Text(member.displayName).tag(member.id)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }
            }
        }
    }

    private var addMemberSection: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Add member")
                    .font(.subheadline.weight(.semibold))
                TextField("Display name", text: $newMemberName)
                    .textFieldStyle(.roundedBorder)
                Picker("Role", selection: $newMemberRole) {
                    Text("Partner").tag(HouseholdMemberRole.partner)
                    Text("Child").tag(HouseholdMemberRole.child)
                    Text("Other").tag(HouseholdMemberRole.other)
                }
                .pickerStyle(.segmented)
                SpendFlowPrimaryButton(
                    title: "Add member",
                    isLoading: viewModel.busyId == "new"
                ) {
                    Task {
                        await viewModel.createMember(
                            name: newMemberName.trimmingCharacters(in: .whitespaces),
                            role: newMemberRole,
                            api: appState.apiClient,
                            refresh: appState.refreshCenter
                        )
                        newMemberName = ""
                    }
                }
                .disabled(newMemberName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }
}
