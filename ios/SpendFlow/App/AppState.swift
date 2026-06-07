import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    let authService = AuthService()
    let appLock = AppLockService()
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
        if authService.isAuthenticated {
            _ = await PushNotificationService.shared.requestAuthorization()
            PushNotificationService.shared.registerForRemoteNotifications()
        }
    }

    func refreshAPIClient() {
        apiClient = APIClient.makeAuthenticated(authService: authService)
        plaidLink = PlaidLinkCoordinator(api: apiClient)
    }
}
