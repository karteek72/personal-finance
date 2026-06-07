import Foundation
import LocalAuthentication
import Observation

@MainActor
@Observable
final class AppLockService {
    private let enabledKey = "spendflow.appLock.enabled"

    var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: enabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
    }

    private(set) var isUnlocked = false

    var biometricsAvailable: Bool {
        var error: NSError?
        let context = LAContext()
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    func resetLockOnBackground() {
        guard isEnabled else {
            isUnlocked = true
            return
        }
        isUnlocked = false
    }

    func unlock() async -> Bool {
        guard isEnabled else {
            isUnlocked = true
            return true
        }

        let context = LAContext()
        context.localizedReason = "Unlock SpendFlow to view your finances"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: context.localizedReason
            )
            isUnlocked = success
            return success
        } catch {
            isUnlocked = false
            return false
        }
    }
}
