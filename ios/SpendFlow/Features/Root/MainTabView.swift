import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }

            MoneyFlowView()
                .tabItem {
                    Label("Flow", systemImage: "arrow.left.arrow.right")
                }

            CategoriesView()
                .tabItem {
                    Label("Categories", systemImage: "square.grid.2x2.fill")
                }

            TransactionsView()
                .tabItem {
                    Label("Activity", systemImage: "list.bullet")
                }

            AccountsView()
                .tabItem {
                    Label("Accounts", systemImage: "building.columns.fill")
                }
        }
        .tint(SpendFlowColors.primary)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Sign out") {
                    Task {
                        await appState.authService.signOut()
                        appState.refreshAPIClient()
                    }
                }
                .font(.caption.weight(.semibold))
            }
        }
    }
}
