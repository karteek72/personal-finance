import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            Section("Security") {
                if appState.appLock.biometricsAvailable {
                    Toggle(
                        "Require Face ID to open",
                        isOn: Binding(
                            get: { appState.appLock.isEnabled },
                            set: { appState.appLock.isEnabled = $0 }
                        )
                    )
                } else {
                    Text("Biometric unlock is not available on this device.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Settings")
    }
}
