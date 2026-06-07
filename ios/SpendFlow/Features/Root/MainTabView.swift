import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @State private var tab: AppTab = .home
    @State private var showSettings = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case .home:
                    DashboardView()
                case .flow:
                    MoneyFlowView()
                case .spend:
                    CategoriesView()
                case .activity:
                    TransactionsView()
                case .wallet:
                    AccountsView()
                case .more:
                    MoreHubView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            FloatingTabBar(selection: $tab)
        }
        .overlay(alignment: .topTrailing) {
            HStack(spacing: 12) {
                RecalculateButton()
                Menu {
                    if let user = appState.authService.user {
                        Text(user.displayName ?? user.email)
                    }
                    Button("Settings") {
                        showSettings = true
                    }
                    Button("Sign out", role: .destructive) {
                        Task {
                            await appState.authService.signOut()
                            appState.refreshAPIClient()
                        }
                    }
                } label: {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.system(size: 26))
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(SpendFlowTheme.primary, SpendFlowTheme.primarySoft)
                }
            }
            .padding(.top, 56)
            .padding(.trailing, 20)
        }
        .ignoresSafeArea(.keyboard)
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                SettingsView()
            }
        }
    }
}
