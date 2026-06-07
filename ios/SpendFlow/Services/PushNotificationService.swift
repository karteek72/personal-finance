import Foundation
import UserNotifications
import UIKit

@MainActor
final class PushNotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationService()

    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            return false
        }
    }

    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }

    func registerTokenWithBackend(_ tokenData: Data, api: APIClient) async {
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        do {
            try await api.registerDeviceToken(token)
        } catch {
            // Non-fatal — alerts still work in-app
        }
    }
}
