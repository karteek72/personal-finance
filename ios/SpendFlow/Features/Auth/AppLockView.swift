import SwiftUI

struct AppLockView: View {
    @Environment(AppState.self) private var appState
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 56))
                .foregroundStyle(SpendFlowTheme.primary)

            Text("SpendFlow is locked")
                .font(.title2.bold())

            Text("Use Face ID or your device passcode to continue.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(SpendFlowTheme.danger)
            }

            Button("Unlock") {
                Task { await attemptUnlock() }
            }
            .buttonStyle(.borderedProminent)
            .tint(SpendFlowTheme.primary)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SpendFlowTheme.background)
        .task {
            await attemptUnlock()
        }
    }

    private func attemptUnlock() async {
        let ok = await appState.appLock.unlock()
        if !ok {
            errorMessage = "Authentication failed. Try again."
        }
    }
}
