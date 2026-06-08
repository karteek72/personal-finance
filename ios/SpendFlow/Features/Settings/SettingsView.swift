import SwiftUI
import SafariServices

private enum LegalPage: String, Identifiable {
    case privacy
    case terms
    case trademarks
    case about

    var id: String { rawValue }

    var title: String {
        switch self {
        case .privacy: "Privacy Policy"
        case .terms: "Terms of Service"
        case .trademarks: "Trademarks"
        case .about: "About"
        }
    }

    var url: URL {
        URL(string: "https://spendflow.stockpulse.win/legal/\(rawValue)")!
    }
}

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @State private var isExporting = false
    @State private var exportURL: URL?
    @State private var showExportShare = false
    @State private var exportError: String?
    @State private var legalPage: LegalPage?

    var body: some View {
        List {
            Section("Account") {
                NavigationLink {
                    ProfileView()
                } label: {
                    Label("Profile", systemImage: "person.crop.circle")
                }

                NavigationLink {
                    NotificationCenterView()
                } label: {
                    Label("Notifications", systemImage: "bell")
                }
            }

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

            Section("Data") {
                Button {
                    Task { await exportData() }
                } label: {
                    HStack {
                        Label("Export my data", systemImage: "square.and.arrow.up")
                        Spacer()
                        if isExporting {
                            ProgressView()
                        }
                    }
                }
                .disabled(isExporting)

                if let exportError {
                    Text(exportError)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }

            Section("Legal") {
                ForEach([LegalPage.privacy, .terms, .trademarks, .about]) { page in
                    Button(page.title) {
                        legalPage = page
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .sheet(item: $legalPage) { page in
            SafariView(url: page.url)
        }
        .sheet(isPresented: $showExportShare) {
            if let exportURL {
                ShareSheet(items: [exportURL])
            }
        }
    }

    private func exportData() async {
        isExporting = true
        exportError = nil
        defer { isExporting = false }

        do {
            let data = try await appState.apiClient.exportUserData()
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("spendflow-export-\(ISO8601DateFormatter().string(from: Date())).json")
            try data.write(to: url)
            exportURL = url
            showExportShare = true
        } catch {
            exportError = error.localizedDescription
        }
    }
}

private struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
