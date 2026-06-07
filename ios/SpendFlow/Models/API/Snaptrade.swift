import Foundation

struct SnaptradePortalResponse: Codable, Sendable {
    let redirectUri: String
}

struct SnaptradePortalRequest: Encodable, Sendable {
    var broker: String?
    var reconnectAuthorizationId: String?
}

struct SnaptradeCompleteResponse: Codable, Sendable {
    let status: String
    let connectionsSynced: Int
    let accountsSynced: Int
    let holdingsUpdated: Int
    let activitiesAdded: Int
    let message: String
}
