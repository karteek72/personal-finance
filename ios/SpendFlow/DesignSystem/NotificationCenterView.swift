import SwiftUI

struct NotificationEntry: Identifiable, Hashable {
    enum Kind: Hashable {
        case insight
        case wrapped
    }

    let id: String
    let kind: Kind
    let title: String
    let message: String
    let dismissible: Bool
    let wrappedYear: Int?
}

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

    func unreadCount(for entries: [NotificationEntry]) -> Int {
        entries.filter { !dismissedIds.contains($0.id) && !readIds.contains($0.id) }.count
    }

    static func wrappedNotificationId(year: Int) -> String {
        "wrapped:\(year)"
    }
}

@MainActor
@Observable
final class NotificationCenterViewModel {
    var entries: [NotificationEntry] = []
    var isLoading = false
    var errorMessage: String?
    let store = NotificationCenterStore()

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let alertsTask = api.getAlerts()
            async let wrappedTask: WrappedResponse? = {
                do {
                    return try await api.getWrapped()
                } catch {
                    return nil
                }
            }()

            let alertsResponse = try await alertsTask
            var nextEntries = alertsResponse.alerts
                .filter { !store.dismissedIds.contains($0.id) }
                .map {
                    NotificationEntry(
                        id: $0.id,
                        kind: .insight,
                        title: $0.title,
                        message: $0.message,
                        dismissible: $0.dismissible,
                        wrappedYear: nil
                    )
                }

            if let wrapped = await wrappedTask, wrapped.transactionCount > 0 {
                let wrappedId = NotificationCenterStore.wrappedNotificationId(year: wrapped.year)
                if !store.dismissedIds.contains(wrappedId) {
                    nextEntries.insert(
                        NotificationEntry(
                            id: wrappedId,
                            kind: .wrapped,
                            title: "Your \(wrapped.year) Wrapped is ready",
                            message: "Your year in money, as a story. Tap to play.",
                            dismissible: true,
                            wrappedYear: wrapped.year
                        ),
                        at: 0
                    )
                }
            }

            entries = nextEntries
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var unreadCount: Int {
        store.unreadCount(for: entries)
    }
}

struct NotificationCenterView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = NotificationCenterViewModel()
    @State private var showWrapped = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading, viewModel.entries.isEmpty {
                    LoadingStateView(message: "Loading notifications…")
                } else if let error = viewModel.errorMessage, viewModel.entries.isEmpty {
                    ErrorStateView(message: error) {
                        Task { await viewModel.load(api: appState.apiClient) }
                    }
                } else if viewModel.entries.isEmpty {
                    FeatureEmptyCard(title: "All caught up", message: "No notifications right now.")
                } else {
                    List {
                        ForEach(viewModel.entries) { entry in
                            notificationRow(entry)
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
            .sheet(isPresented: $showWrapped) {
                NavigationStack {
                    WrappedView()
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Done") { showWrapped = false }
                            }
                        }
                }
            }
        }
    }

    private func notificationRow(_ entry: NotificationEntry) -> some View {
        let unread = viewModel.store.isUnread(entry.id)

        return VStack(alignment: .leading, spacing: 6) {
            Button {
                viewModel.store.markRead(entry.id)
                if entry.kind == .wrapped {
                    showWrapped = true
                    dismiss()
                }
            } label: {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(entry.title)
                            .font(.subheadline.weight(unread ? .bold : .semibold))
                            .foregroundStyle(SpendFlowTheme.text)
                        Spacer()
                        if unread {
                            Circle().fill(SpendFlowTheme.primary).frame(width: 8, height: 8)
                        }
                    }
                    Text(entry.message)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                        .multilineTextAlignment(.leading)
                    if entry.kind == .wrapped {
                        Text("Tap to open →")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(SpendFlowTheme.primary)
                    }
                }
            }
            .buttonStyle(.plain)

            if entry.dismissible {
                HStack {
                    Button("Dismiss") {
                        viewModel.store.dismiss(entry.id)
                        viewModel.entries.removeAll { $0.id == entry.id }
                    }
                    .font(.caption.weight(.semibold))
                    Spacer()
                    if unread {
                        Button("Mark read") {
                            viewModel.store.markRead(entry.id)
                        }
                        .font(.caption.weight(.semibold))
                    }
                }
            }
        }
        .padding(.vertical, 4)
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
