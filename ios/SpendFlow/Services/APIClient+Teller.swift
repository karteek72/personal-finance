import Foundation

extension APIClient {
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
        return try await send(
            APIRequest(path: "/teller/exchange", method: .post, body: body)
        )
    }
}
