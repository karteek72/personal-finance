import Foundation

enum HouseholdMemberRole: String, Codable, Sendable {
    case owner
    case partner
    case child
    case other
}

struct HouseholdMemberInvite: Codable, Sendable {
    let id: String
    let email: String
    let expiresAt: String
    let status: String
}

struct HouseholdMember: Codable, Identifiable, Sendable {
    let id: String
    let displayName: String
    let role: HouseholdMemberRole
    let avatarColor: String
    let userId: String?
    let createdAt: String
    let pendingInvite: HouseholdMemberInvite?
}

struct HouseholdAccountLink: Codable, Identifiable, Sendable {
    var id: String { accountId }
    let accountId: String
    let name: String
    let mask: String
    let institutionName: String
    let balanceCurrent: String
    let memberId: String?
    let memberName: String?
    let memberColor: String?
    let ownedByCurrentUser: Bool?
    let ownerUserId: String?
}

struct HouseholdResponse: Codable, Sendable {
    struct HouseholdInfo: Codable, Sendable {
        let id: String
        let name: String
        let createdAt: String
    }

    let accessRole: String
    let household: HouseholdInfo
    let members: [HouseholdMember]
    let accounts: [HouseholdAccountLink]
}

struct HouseholdInviteResponse: Codable, Sendable {
    let invitationId: String
    let inviteUrl: String
    let expiresAt: String
    let email: String
}

struct HouseholdInvitePreview: Codable, Sendable {
    let householdName: String
    let memberName: String
    let memberRole: String
    let email: String
    let expiresAt: String
    let status: String
}

struct HouseholdInviteAcceptResponse: Codable, Sendable {
    let householdId: String
    let householdName: String
    let memberId: String
    let memberDisplayName: String
}

struct HouseholdMemberInsight: Codable, Identifiable, Sendable {
    let memberId: String
    let displayName: String
    let role: HouseholdMemberRole
    let avatarColor: String
    let accountCount: Int
    let totalSpent: String
    let totalIncome: String
    let topCategory: TopCategory

    var id: String { memberId }

    struct TopCategory: Codable, Sendable {
        let name: String
        let amount: String
    }
}

struct HouseholdInsightsResponse: Codable, Sendable {
    struct Totals: Codable, Sendable {
        let expenses: String
        let income: String
        let net: String
    }

    struct Period: Codable, Sendable {
        let from: String
        let to: String
    }

    let members: [HouseholdMemberInsight]
    let unassignedAccounts: [HouseholdAccountLink]
    let householdTotals: Totals
    let period: Period
}
