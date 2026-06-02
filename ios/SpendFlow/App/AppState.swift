import Foundation
import Observation

@MainActor
@Observable
final class AppState {
    let authService = AuthService()
    var apiClient: APIClient

    init() {
        apiClient = APIClient(authService: authService)
    }

    func bootstrap() async {
        await authService.bootstrap()
        refreshAPIClient()
    }

    func refreshAPIClient() {
        apiClient = APIClient.makeAuthenticated(authService: authService)
    }
}
