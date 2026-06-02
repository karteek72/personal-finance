import Foundation

/// Coordinates Plaid Link on iOS. Add the Plaid Link iOS SDK (Phase 2) and call
/// `presentLink(from:)` after fetching a link token from the backend.
@MainActor
final class PlaidLinkCoordinator: ObservableObject {
    @Published var isPresenting = false
    @Published var statusMessage: String?

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func connectAccount() async {
        statusMessage = nil
        do {
            let response = try await api.createPlaidLinkToken(platform: "ios")
            // Phase 2: Present PLKPlaidLinkViewController with response.linkToken
            statusMessage =
                "Plaid Link SDK required. Link token received (\(response.linkToken.prefix(12))…)."
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func handlePublicToken(_ publicToken: String) async {
        do {
            let result = try await api.exchangePlaidToken(publicToken: publicToken)
            statusMessage = result.message
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}
