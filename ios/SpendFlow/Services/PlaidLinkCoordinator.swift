import Foundation
import LinkKit
import SwiftUI

@MainActor
@Observable
final class PlaidLinkCoordinator {
    var linkHandler: Handler?
    var isPresenting = false
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
            let response = try await api.createPlaidLinkToken(platform: "ios")
            var configuration = LinkTokenConfiguration(
                token: response.linkToken,
                onSuccess: { [weak self] linkSuccess in
                    Task { await self?.handleSuccess(publicToken: linkSuccess.publicToken) }
                }
            )
            configuration.onExit = { [weak self] exit in
                self?.handleExit(exit)
            }

            switch Plaid.create(configuration) {
            case .success(let handler):
                linkHandler = handler
                isPresenting = true
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleSuccess(publicToken: String) async {
        isPresenting = false
        isLoading = true
        defer {
            isLoading = false
            resetLinkSession()
        }

        do {
            let result = try await api.exchangePlaidToken(publicToken: publicToken)
            statusMessage = result.message
            await onLinked?()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleExit(_ exit: LinkExit) {
        isPresenting = false
        resetLinkSession()

        if let exitError = exit.error {
            errorMessage = exitError.displayMessage ?? exitError.errorMessage
        }
    }

    func dismissLinkPresentation() {
        isPresenting = false
        resetLinkSession()
    }

    private func resetLinkSession() {
        linkHandler = nil
        onLinked = nil
    }
}

extension View {
    @ViewBuilder
    func spendFlowPlaidLink(coordinator: PlaidLinkCoordinator) -> some View {
        if let handler = coordinator.linkHandler {
            plaidLink(
                isPresented: Binding(
                    get: { coordinator.isPresenting },
                    set: { isPresented in
                        coordinator.isPresenting = isPresented
                        if !isPresented {
                            coordinator.dismissLinkPresentation()
                        }
                    }
                ),
                handler: handler
            )
        } else {
            self
        }
    }
}
