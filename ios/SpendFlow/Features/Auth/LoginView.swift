import GoogleSignIn
import SwiftUI
import UIKit

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var isSigningIn = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("SpendFlow")
                .font(.largeTitle.weight(.heavy))
                .foregroundStyle(SpendFlowColors.primary)

            Text("Welcome back")
                .font(.title2.weight(.bold))

            Text("Sign in to pick up where you left off")
                .font(.subheadline)
                .foregroundStyle(SpendFlowColors.textMuted)

            if AppConfig.isGoogleSignInConfigured {
                Button {
                    Task { await signInWithGoogle() }
                } label: {
                    HStack {
                        if isSigningIn {
                            ProgressView()
                                .tint(.white)
                        }
                        Text(isSigningIn ? "Signing in…" : "Continue with Google")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .tint(SpendFlowColors.primary)
                .disabled(isSigningIn)
            } else {
                SpendFlowCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Google Sign-In not configured")
                            .font(.subheadline.weight(.semibold))
                        Text(
                            "Set GOOGLE_CLIENT_ID (iOS) and GOOGLE_SERVER_CLIENT_ID (web, same as backend) in Config/Debug.xcconfig, and add the iOS reversed client ID URL scheme to Info.plist."
                        )
                        .font(.caption)
                        .foregroundStyle(SpendFlowColors.textMuted)
                    }
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(SpendFlowColors.danger)
            }

            Spacer()
        }
        .padding(24)
    }

    @MainActor
    private func signInWithGoogle() async {
        guard let root = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController else {
            errorMessage = "Unable to present sign-in"
            return
        }

        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: root)
            guard let idToken = result.user.idToken?.tokenString else {
                errorMessage = "Google did not return an ID token"
                return
            }

            let session = try await appState.apiClient.signInWithGoogle(idToken: idToken)
            try appState.authService.signIn(session: session)
            appState.refreshAPIClient()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
