import Foundation
import Observation

@MainActor
@Observable
final class FinancialRefreshCenter {
    private(set) var refreshToken = UUID()
    var isRecomputing = false
    var lastRecomputeMessage: String?

    func bump() {
        refreshToken = UUID()
    }

    func recomputeAll(api: APIClient) async {
        guard !isRecomputing else { return }
        isRecomputing = true
        defer { isRecomputing = false }

        do {
            let result = try await api.recomputeAnalytics()
            lastRecomputeMessage = result.message ?? "Analytics refreshed."
            bump()
        } catch {
            lastRecomputeMessage = error.localizedDescription
        }
    }
}
