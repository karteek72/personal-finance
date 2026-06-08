import Foundation

extension APIClient {
    func syncAllPlaidItems() async throws -> PlaidSyncAllResponse {
        try await send(APIRequest(path: "/plaid/sync", method: .post))
    }

    func createPlaidLinkToken(platform: String = "ios", itemId: String? = nil) async throws -> PlaidLinkTokenResponse {
        struct Body: Encodable {
            let platform: String
            let itemId: String?
        }
        let body = try JSONEncoder.api.encode(Body(platform: platform, itemId: itemId))
        return try await send(
            APIRequest(path: "/plaid/link-token", method: .post, body: body)
        )
    }
}
