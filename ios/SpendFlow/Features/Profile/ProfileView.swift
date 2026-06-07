import SwiftUI

@MainActor
@Observable
final class ProfileViewModel {
    var profile: UserProfileResponse?
    var isLoading = false
    var isSaving = false
    var errorMessage: String?
    var savedMessage: String?

    func load(api: APIClient) async {
        isLoading = profile == nil
        errorMessage = nil
        defer { isLoading = false }

        do {
            profile = try await api.getUserProfile()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func save(patch: UserProfilePatch, api: APIClient, refresh: FinancialRefreshCenter) async {
        isSaving = true
        errorMessage = nil
        savedMessage = nil
        defer { isSaving = false }

        do {
            profile = try await api.patchUserProfile(patch)
            refresh.bump()
            savedMessage = "Profile saved."
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ProfileView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = ProfileViewModel()

    @State private var displayName = ""
    @State private var currentAge = ""
    @State private var householdSize = ""
    @State private var annualGrossIncome = ""
    @State private var targetRetirementAge = ""
    @State private var employmentStatus: EmploymentStatus = .employed
    @State private var riskTolerance: RiskTolerance = .moderate
    @State private var withdrawalRate = 4.0
    @State private var realReturn = 6.0

    var body: some View {
        Form {
            if let saved = viewModel.savedMessage {
                Section {
                    Text(saved)
                        .foregroundStyle(SpendFlowTheme.success)
                }
            }
            if let error = viewModel.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(SpendFlowTheme.danger)
                }
            }

            Section("Identity") {
                TextField("Display name", text: $displayName)
                if let email = viewModel.profile?.user.email {
                    LabeledContent("Email", value: email)
                }
            }

            Section("Demographics") {
                TextField("Current age", text: $currentAge)
                    .keyboardType(.numberPad)
                TextField("Household size", text: $householdSize)
                    .keyboardType(.numberPad)
                TextField("Target retirement age", text: $targetRetirementAge)
                    .keyboardType(.numberPad)
            }

            Section("Income & work") {
                TextField("Annual gross income", text: $annualGrossIncome)
                    .keyboardType(.decimalPad)
                Picker("Employment", selection: $employmentStatus) {
                    Text("Employed").tag(EmploymentStatus.employed)
                    Text("Self-employed").tag(EmploymentStatus.selfEmployed)
                    Text("Retired").tag(EmploymentStatus.retired)
                    Text("Student").tag(EmploymentStatus.student)
                    Text("Other").tag(EmploymentStatus.other)
                }
            }

            Section("Investing assumptions") {
                Picker("Risk tolerance", selection: $riskTolerance) {
                    Text("Conservative").tag(RiskTolerance.conservative)
                    Text("Moderate").tag(RiskTolerance.moderate)
                    Text("Aggressive").tag(RiskTolerance.aggressive)
                }
                VStack(alignment: .leading) {
                    Text("Withdrawal rate: \(withdrawalRate, specifier: "%.1f")%")
                    Slider(value: $withdrawalRate, in: 2 ... 6, step: 0.5)
                }
                VStack(alignment: .leading) {
                    Text("Real return: \(realReturn, specifier: "%.1f")%")
                    Slider(value: $realReturn, in: 2 ... 10, step: 0.5)
                }
            }

            if let profile = viewModel.profile {
                Section("Derived") {
                    if profile.isDefaultAge {
                        Label("Using default age — save to personalize FIRE", systemImage: "info.circle")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.warning)
                    }
                    if let netWorth = profile.currentNetWorth {
                        LabeledContent("Net worth", value: netWorth)
                    }
                    if let monthlySpend = profile.monthlySpend {
                        LabeledContent("Monthly spend", value: monthlySpend)
                    }
                }
            }

            Section {
                SpendFlowPrimaryButton(title: "Save profile", isLoading: viewModel.isSaving) {
                    Task { await saveProfile() }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if viewModel.isLoading, viewModel.profile == nil {
                LoadingStateView(message: "Loading profile…")
            }
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
            populateForm()
        }
    }

    private func populateForm() {
        guard let profile = viewModel.profile else { return }
        displayName = profile.user.displayName ?? ""
        currentAge = String(profile.currentAge)
        householdSize = profile.householdSize.map(String.init) ?? ""
        annualGrossIncome = profile.annualGrossIncome ?? ""
        targetRetirementAge = profile.targetRetirementAge.map(String.init) ?? ""
        employmentStatus = profile.employmentStatus ?? .employed
        riskTolerance = profile.riskTolerance ?? .moderate
        withdrawalRate = profile.withdrawalRate
        realReturn = profile.realReturn
    }

    private func saveProfile() async {
        guard let age = Int(currentAge), age >= 18, age <= 100 else {
            viewModel.errorMessage = "Enter a valid age (18–100)."
            return
        }

        var patch = UserProfilePatch()
        patch.displayName = displayName.trimmingCharacters(in: .whitespaces)
        patch.currentAge = age
        patch.householdSize = Int(householdSize)
        patch.targetRetirementAge = Int(targetRetirementAge)
        patch.employmentStatus = employmentStatus
        patch.riskTolerance = riskTolerance
        patch.withdrawalRate = withdrawalRate
        patch.realReturn = realReturn
        if let income = Double(annualGrossIncome) {
            patch.annualGrossIncome = income
        }

        await viewModel.save(
            patch: patch,
            api: appState.apiClient,
            refresh: appState.refreshCenter
        )
    }
}
