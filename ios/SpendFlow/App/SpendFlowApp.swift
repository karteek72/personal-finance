import GoogleSignIn
import SwiftUI

@main
struct SpendFlowApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appState = AppState()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .task {
                    configureGoogleSignIn()
                    await appState.bootstrap()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .background {
                        appState.appLock.resetLockOnBackground()
                    }
                }
                .onOpenURL { url in
                    handleDeepLink(url, appState: appState)
                }
        }
    }

    private func handleDeepLink(_ url: URL, appState: AppState) {
        guard url.scheme == "spendflow" else { return }
        if url.host == "invite",
           let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let token = components.queryItems?.first(where: { $0.name == "token" })?.value {
            appState.pendingInviteToken = token
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
                if appState.appLock.isEnabled && !appState.appLock.isUnlocked {
                    AppLockView()
                } else {
                    MainTabView()
                }
            } else {
                LoginView()
            }
        }
        .background(SpendFlowTheme.background.ignoresSafeArea())
        .sheet(item: inviteTokenBinding) { token in
            AcceptInviteView(token: token.value)
        }
        .onReceive(NotificationCenter.default.publisher(for: .didRegisterPushToken)) { note in
            guard let tokenData = note.object as? Data else { return }
            Task {
                await PushNotificationService.shared.registerTokenWithBackend(
                    tokenData,
                    api: appState.apiClient
                )
            }
        }
    }

    private var inviteTokenBinding: Binding<InviteTokenItem?> {
        Binding(
            get: {
                guard let token = appState.pendingInviteToken else { return nil }
                return InviteTokenItem(value: token)
            },
            set: { newValue in
                if newValue == nil {
                    appState.pendingInviteToken = nil
                }
            }
        )
    }
}

private struct InviteTokenItem: Identifiable {
    let value: String
    var id: String { value }
}
