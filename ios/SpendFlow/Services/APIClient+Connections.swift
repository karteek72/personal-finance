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

    func getTellerConfig() async throws -> TellerConnectConfig {
        try await send(APIRequest(path: "/teller/config"))
    }

    func exchangeTellerToken(
        accessToken: String,
        enrollmentId: String,
        institutionName: String? = nil
    ) async throws -> TellerExchangeResponse {
        struct Body: Encodable {
            let accessToken: String
            let enrollmentId: String
            let institutionName: String?
        }
        let body = try JSONEncoder.api.encode(
            Body(accessToken: accessToken, enrollmentId: enrollmentId, institutionName: institutionName)
        )
        return try await send(APIRequest(path: "/teller/exchange", method: .post, body: body))
    }

    func exportUserData() async throws -> Data {
        let token = await MainActor.run { authService?.accessToken }
        let (data, response) = try await rawSend(
            APIRequest(path: "/auth/export"),
            accessToken: token
        )
        guard (200 ... 299).contains(response.statusCode) else {
            throw APIError.httpStatus(response.statusCode, message: "Export failed")
        }
        return data
    }
}
