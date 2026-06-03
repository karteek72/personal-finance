import Foundation

struct User: Codable, Equatable, Sendable {
    let id: String
    let email: String
    let displayName: String?
    let createdAt: String
}

struct AuthSessionResponse: Codable, Sendable {
    let user: User
    let accessToken: String
    let refreshToken: String
}

struct AuthRefreshResponse: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
}

struct AuthMeResponse: Codable, Sendable {
    let user: User
}

struct StoredAuthSession: Codable, Equatable, Sendable {
    let user: User
    let refreshToken: String
}
