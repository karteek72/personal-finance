import Foundation

extension APIClient {
    func updateHouseholdName(_ name: String) async throws -> HouseholdNameResponse {
        let body = try JSONEncoder.api.encode(["name": name])
        return try await send(APIRequest(path: "/household", method: .patch, body: body))
    }

    func createHouseholdMember(
        displayName: String,
        role: HouseholdMemberRole
    ) async throws -> HouseholdMember {
        struct Body: Encodable {
            let displayName: String
            let role: HouseholdMemberRole
        }
        let body = try JSONEncoder.api.encode(Body(displayName: displayName, role: role))
        return try await send(APIRequest(path: "/household/members", method: .post, body: body))
    }

    func updateHouseholdMember(
        memberId: String,
        displayName: String? = nil,
        role: HouseholdMemberRole? = nil
    ) async throws -> HouseholdMember {
        struct Body: Encodable {
            var displayName: String?
            var role: HouseholdMemberRole?
        }
        let body = try JSONEncoder.api.encode(Body(displayName: displayName, role: role))
        return try await send(
            APIRequest(path: "/household/members/\(memberId)", method: .patch, body: body)
        )
    }

    func deleteHouseholdMember(memberId: String) async throws -> StatusResponse {
        try await send(APIRequest(path: "/household/members/\(memberId)", method: .delete))
    }

    func assignAccountToMember(accountId: String, memberId: String) async throws -> AssignAccountResponse {
        let body = try JSONEncoder.api.encode(["memberId": memberId])
        return try await send(
            APIRequest(path: "/household/accounts/\(accountId)/assign", method: .put, body: body)
        )
    }

    func inviteHouseholdMember(memberId: String, email: String) async throws -> HouseholdInviteResponse {
        let body = try JSONEncoder.api.encode(["email": email])
        return try await send(
            APIRequest(path: "/household/members/\(memberId)/invite", method: .post, body: body)
        )
    }

    func revokeHouseholdInvite(memberId: String) async throws -> StatusResponse {
        try await send(APIRequest(path: "/household/members/\(memberId)/invite", method: .delete))
    }

    func previewHouseholdInvite(token: String) async throws -> HouseholdInvitePreview {
        try await send(
            APIRequest(
                path: "/household/invites/preview",
                queryItems: [.init(name: "token", value: token)]
            )
        )
    }

    func acceptHouseholdInvite(token: String) async throws -> HouseholdInviteAcceptResponse {
        let body = try JSONEncoder.api.encode(["token": token])
        return try await send(
            APIRequest(path: "/household/invites/accept", method: .post, body: body)
        )
    }
}
