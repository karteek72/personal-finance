import Foundation

extension APIClient {
    func createSnaptradePortalUrl(
        broker: String? = nil,
        reconnectAuthorizationId: String? = nil
    ) async throws -> SnaptradePortalResponse {
        let body = try JSONEncoder.api.encode(
            SnaptradePortalRequest(broker: broker, reconnectAuthorizationId: reconnectAuthorizationId)
        )
        return try await send(
            APIRequest(path: "/snaptrade/portal-url", method: .post, body: body)
        )
    }

    func completeSnaptradeConnection() async throws -> SnaptradeCompleteResponse {
        try await send(APIRequest(path: "/snaptrade/complete", method: .post))
    }
}
