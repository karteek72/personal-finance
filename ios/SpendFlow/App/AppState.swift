import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    let authService = AuthService()
    var apiClient: APIClient
    private(set) var plaidLink: PlaidLinkCoordinator

    init() {
        let client = APIClient(authService: authService)
        apiClient = client
        plaidLink = PlaidLinkCoordinator(api: client)
    }

    func bootstrap() async {
        await authService.bootstrap()
        refreshAPIClient()
    }

    func refreshAPIClient() {
        apiClient = APIClient.makeAuthenticated(authService: authService)
        plaidLink = PlaidLinkCoordinator(api: apiClient)
    }
}
