import Foundation
import SafariServices
import SwiftUI

@MainActor
@Observable
final class SnapTradeLinkCoordinator: NSObject {
    var portalURL: URL?
    var isPresentingSafari = false
    var isLoading = false
    var statusMessage: String?
    var errorMessage: String?

    private let api: APIClient
    private var onLinked: (() async -> Void)?

    init(api: APIClient) {
        self.api = api
    }

    func startLink(onLinked: @escaping () async -> Void) async {
        guard !isLoading else { return }

        self.onLinked = onLinked
        isLoading = true
        errorMessage = nil
        statusMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.createSnaptradePortalUrl()
            guard let url = URL(string: response.redirectUri) else {
                errorMessage = "Invalid SnapTrade portal URL."
                return
            }
            portalURL = url
            isPresentingSafari = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleSafariDismissed() {
        isPresentingSafari = false
        portalURL = nil
        Task { await completeConnection() }
    }

    private func completeConnection() async {
        isLoading = true
        defer {
            isLoading = false
            onLinked = nil
        }

        do {
            let result = try await api.completeSnaptradeConnection()
            statusMessage = result.message
            await onLinked?()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct SnapTradeSafariView: UIViewControllerRepresentable {
    let url: URL
    let onDismiss: () -> Void

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onDismiss: onDismiss)
    }

    final class Coordinator: NSObject, SFSafariViewControllerDelegate {
        let onDismiss: () -> Void

        init(onDismiss: @escaping () -> Void) {
            self.onDismiss = onDismiss
        }

        func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
            onDismiss()
        }
    }
}

extension View {
    @ViewBuilder
    func spendFlowSnapTradeLink(coordinator: SnapTradeLinkCoordinator) -> some View {
        sheet(isPresented: Binding(
            get: { coordinator.isPresentingSafari },
            set: { isPresented in
                if !isPresented {
                    coordinator.handleSafariDismissed()
                }
            }
        )) {
            if let url = coordinator.portalURL {
                SnapTradeSafariView(url: url) {
                    coordinator.handleSafariDismissed()
                }
                .ignoresSafeArea()
            }
        }
    }
}
