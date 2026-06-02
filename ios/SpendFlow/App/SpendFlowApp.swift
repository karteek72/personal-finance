import GoogleSignIn
import SwiftUI

@main
struct SpendFlowApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .task {
                    configureGoogleSignIn()
                    await appState.bootstrap()
                }
        }
    }

    private func configureGoogleSignIn() {
        guard let clientID = AppConfig.googleClientID,
              let serverClientID = AppConfig.googleServerClientID else {
            return
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: clientID,
            serverClientID: serverClientID
        )
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.authService.isBootstrapping {
                LoadingStateView(message: "Loading…")
            } else if appState.authService.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .background(SpendFlowColors.background.ignoresSafeArea())
    }
}
