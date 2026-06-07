import SwiftUI

struct RecalculateButton: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Button {
            Task {
                await appState.refreshCenter.recomputeAll(api: appState.apiClient)
            }
        } label: {
            if appState.refreshCenter.isRecomputing {
                ProgressView()
                    .controlSize(.small)
            } else {
                Image(systemName: "arrow.triangle.2.circlepath")
            }
        }
        .disabled(appState.refreshCenter.isRecomputing)
        .accessibilityLabel("Recalculate all analytics")
    }
}
