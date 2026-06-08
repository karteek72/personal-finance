import SwiftUI

@MainActor
@Observable
final class NotificationCenterStore {
    private let readKey = "notificationReadIds"
    private let dismissedKey = "notificationDismissedIds"

    var readIds: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: readKey) ?? []) }
        set { UserDefaults.standard.set(Array(newValue), forKey: readKey) }
    }

    var dismissedIds: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: dismissedKey) ?? []) }
        set { UserDefaults.standard.set(Array(newValue), forKey: dismissedKey) }
    }

    func markRead(_ id: String) {
        var ids = readIds
        ids.insert(id)
        readIds = ids
    }

    func dismiss(_ id: String) {
        var ids = dismissedIds
        ids.insert(id)
        dismissedIds = ids
        markRead(id)
    }

    func isUnread(_ id: String) -> Bool {
        !readIds.contains(id) && !dismissedIds.contains(id)
    }

    func unreadCount(for alerts: [Alert]) -> Int {
        alerts.filter { !dismissedIds.contains($0.id) && !readIds.contains($0.id) }.count
    }
}

@MainActor
@Observable
final class NotificationCenterViewModel {
    var alerts: [Alert] = []
    var isLoading = false
    var errorMessage: String?
    let store = NotificationCenterStore()

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.getAlerts()
            alerts = response.alerts.filter { !store.dismissedIds.contains($0.id) }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var unreadCount: Int {
        store.unreadCount(for: alerts)
    }
}

struct NotificationCenterView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = NotificationCenterViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading, viewModel.alerts.isEmpty {
                    LoadingStateView(message: "Loading alerts…")
                } else if let error = viewModel.errorMessage, viewModel.alerts.isEmpty {
                    ErrorStateView(message: error) {
                        Task { await viewModel.load(api: appState.apiClient) }
                    }
                } else if viewModel.alerts.isEmpty {
                    FeatureEmptyCard(title: "All caught up", message: "No alerts right now.")
                } else {
                    List {
                        ForEach(viewModel.alerts) { alert in
                            alertRow(alert)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Notifications")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .refreshable {
                await viewModel.load(api: appState.apiClient)
            }
            .task {
                await viewModel.load(api: appState.apiClient)
            }
        }
    }

    private func alertRow(_ alert: Alert) -> some View {
        let unread = viewModel.store.isUnread(alert.id)
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(alert.title)
                    .font(.subheadline.weight(unread ? .bold : .semibold))
                Spacer()
                if unread {
                    Circle().fill(SpendFlowTheme.primary).frame(width: 8, height: 8)
                }
            }
            Text(alert.message)
                .font(.caption)
                .foregroundStyle(SpendFlowTheme.textMuted)
            HStack {
                if alert.dismissible {
                    Button("Dismiss") {
                        viewModel.store.dismiss(alert.id)
                        viewModel.alerts.removeAll { $0.id == alert.id }
                    }
                    .font(.caption.weight(.semibold))
                }
                Spacer()
                if unread {
                    Button("Mark read") {
                        viewModel.store.markRead(alert.id)
                    }
                    .font(.caption.weight(.semibold))
                }
            }
        }
        .padding(.vertical, 4)
        .onAppear {
            if unread {
                viewModel.store.markRead(alert.id)
            }
        }
    }
}

struct NotificationBellButton: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = NotificationCenterViewModel()
    @State private var showPanel = false

    var body: some View {
        Button {
            showPanel = true
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                if viewModel.unreadCount > 0 {
                    Text(viewModel.unreadCount > 9 ? "9+" : "\(viewModel.unreadCount)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(SpendFlowTheme.danger, in: Capsule())
                        .offset(x: 6, y: -6)
                }
            }
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
        .sheet(isPresented: $showPanel) {
            NotificationCenterView()
        }
    }
}
