import Foundation

enum EmploymentStatus: String, Codable, Sendable {
    case employed
    case selfEmployed = "self_employed"
    case retired
    case student
    case other
}

enum RiskTolerance: String, Codable, Sendable {
    case conservative
    case moderate
    case aggressive
}

struct UserProfileResponse: Codable, Sendable {
    let user: User
    let currentAge: Int
    let isDefaultAge: Bool
    let householdSize: Int?
    let annualGrossIncome: String?
    let targetRetirementAge: Int?
    let employmentStatus: EmploymentStatus?
    let riskTolerance: RiskTolerance?
    let withdrawalRate: Double
    let realReturn: Double
    let hasLinkedAccounts: Bool
    let currentNetWorth: String?
    let monthlySpend: String?
    let monthlyInvest: String?
}

struct UserProfilePatch: Encodable, Sendable {
    var displayName: String?
    var currentAge: Int?
    var householdSize: Int?
    var annualGrossIncome: Double?
    var targetRetirementAge: Int?
    var employmentStatus: EmploymentStatus?
    var riskTolerance: RiskTolerance?
    var withdrawalRate: Double?
    var realReturn: Double?
}

struct AnalyticsProfileResponse: Codable, Sendable {
    let currentAge: Int
    let isDefaultAge: Bool
    let householdSize: Int?
    let annualGrossIncome: String?
    let targetRetirementAge: Int?
    let employmentStatus: EmploymentStatus?
    let riskTolerance: RiskTolerance?
    let withdrawalRate: Double
    let realReturn: Double
    let hasLinkedAccounts: Bool
    let currentNetWorth: String?
    let monthlySpend: String?
    let monthlyInvest: String?
}

struct CoachResponse: Codable, Sendable {
    struct QA: Codable, Identifiable, Sendable {
        var id: String { q }
        let q: String
        let a: String
    }

    let narrative: String
    let forecast: String
    let qa: [QA]
    let isLive: Bool?
}

struct CoachAskResponse: Codable, Sendable {
    let answer: String
    let isLive: Bool
}
