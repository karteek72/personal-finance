import GoogleSignIn
import SwiftUI
import UIKit

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var isSigningIn = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            SpendFlowTheme.meshBackground.ignoresSafeArea()

            // Decorative blobs
            Circle()
                .fill(SpendFlowTheme.primary.opacity(0.15))
                .frame(width: 280, height: 280)
                .blur(radius: 60)
                .offset(x: -120, y: -200)
            Circle()
                .fill(SpendFlowTheme.accent.opacity(0.2))
                .frame(width: 220, height: 220)
                .blur(radius: 50)
                .offset(x: 140, y: 120)

            VStack(spacing: 28) {
                Spacer()

                VStack(spacing: 12) {
                    GradientBrandText(text: "SpendFlow", font: .system(size: 40, weight: .heavy, design: .rounded))
                    Text("Track spend. Stay unbothered.")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.text)
                    Text("Your money dashboard — no spreadsheet energy.")
                        .font(.subheadline)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                        .multilineTextAlignment(.center)
                }

                GlassCard {
                    VStack(spacing: 16) {
                        if AppConfig.isGoogleSignInConfigured {
                            SpendFlowPrimaryButton(
                                title: isSigningIn ? "Signing in…" : "Continue with Google",
                                isLoading: isSigningIn
                            ) {
                                Task { await signInWithGoogle() }
                            }
                        } else {
                            Text("Google Sign-In not configured")
                                .font(.subheadline.weight(.semibold))
                            Text("Set GOOGLE_CLIENT_ID and GOOGLE_SERVER_CLIENT_ID in Config/Debug.xcconfig.")
                                .font(.caption)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(SpendFlowTheme.danger)
                                .multilineTextAlignment(.center)
                        }
                    }
                }
                .padding(.horizontal, 24)

                Spacer()
                Text("Built for real life, not receipt hoarding 📱")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .padding(.bottom, 32)
            }
        }
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
