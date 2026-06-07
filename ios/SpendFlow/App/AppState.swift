import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    let authService = AuthService()
    let appLock = AppLockService()
    let refreshCenter = FinancialRefreshCenter()
    var apiClient: APIClient
    private(set) var plaidLink: PlaidLinkCoordinator
    private(set) var snapTradeLink: SnapTradeLinkCoordinator

    init() {
        let client = APIClient(authService: authService)
        apiClient = client
        plaidLink = PlaidLinkCoordinator(api: client)
        snapTradeLink = SnapTradeLinkCoordinator(api: client)
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
        snapTradeLink = SnapTradeLinkCoordinator(api: apiClient)
    }
}
