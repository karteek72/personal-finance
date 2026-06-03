import Foundation
import Observation

@MainActor
@Observable
final class AuthService {
    private(set) var user: User?
    private(set) var accessToken: String?
    private(set) var isAuthenticated = false
    private(set) var isBootstrapping = true

    private var refreshToken: String?

    func bootstrap() async {
        defer { isBootstrapping = false }

        guard let sessionData = try? KeychainService.read(for: .storedSession),
              let session = try? JSONDecoder.api.decode(StoredAuthSession.self, from: sessionData) else {
            clearInMemorySession()
            return
        }

        refreshToken = session.refreshToken
        user = session.user

        do {
            try await refreshAccessToken()
            isAuthenticated = true
        } catch {
            try? KeychainService.clearAll()
            clearInMemorySession()
        }
    }

    func signIn(session: AuthSessionResponse) throws {
        user = session.user
        accessToken = session.accessToken
        refreshToken = session.refreshToken
        isAuthenticated = true

        let stored = StoredAuthSession(user: session.user, refreshToken: session.refreshToken)
        let data = try JSONEncoder.api.encode(stored)
        try KeychainService.save(data, for: .storedSession)
        try KeychainService.save(Data(session.refreshToken.utf8), for: .refreshToken)
    }

    func refreshAccessToken() async throws {
        guard let refreshToken else {
            throw APIError.unauthenticated
        }

        let response = try await unauthenticatedClient.refreshSession(refreshToken: refreshToken)
        accessToken = response.accessToken
        self.refreshToken = response.refreshToken

        if let user {
            let stored = StoredAuthSession(user: user, refreshToken: response.refreshToken)
            let data = try JSONEncoder.api.encode(stored)
            try KeychainService.save(data, for: .storedSession)
            try KeychainService.save(Data(response.refreshToken.utf8), for: .refreshToken)
        }
    }

    func signOut() async {
        if let accessToken {
            try? await unauthenticatedClient.signOut(accessToken: accessToken)
        }
        try? KeychainService.clearAll()
        clearInMemorySession()
    }

    private func clearInMemorySession() {
        user = nil
        accessToken = nil
        refreshToken = nil
        isAuthenticated = false
    }

    private let unauthenticatedClient = APIClient(authService: nil)
}
