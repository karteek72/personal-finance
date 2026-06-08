import Foundation

struct Account: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let officialName: String?
    let type: AccountType
    let subtype: String?
    let mask: String?
    let balanceCurrent: String
    let balanceAvailable: String?
    let currencyCode: String
    let institutionName: String
    let lastSyncedAt: String?
    let status: AccountStatus
    let source: AccountSource?
    let connectionProvider: ConnectionProvider?
    let tellerEnrollmentId: String?
    let plaidItemId: String?
    let memberId: String?
    let memberName: String?
    let memberColor: String?
    let liability: AccountCreditLiability?

    enum CodingKeys: String, CodingKey {
        case id, name, officialName, type, subtype, mask
        case balanceCurrent, balanceAvailable, currencyCode, institutionName
        case lastSyncedAt, status, source, connectionProvider, tellerEnrollmentId
        case plaidItemId, memberId, memberName, memberColor, liability
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        officialName = try container.decodeIfPresent(String.self, forKey: .officialName)
        type = try container.decode(AccountType.self, forKey: .type)
        subtype = try container.decodeIfPresent(String.self, forKey: .subtype)
        mask = try container.decodeIfPresent(String.self, forKey: .mask)
        balanceCurrent = try APIDecoding.decodeMoney(from: container, forKey: .balanceCurrent)
        balanceAvailable = try APIDecoding.decodeOptionalMoney(from: container, forKey: .balanceAvailable)
        currencyCode = try container.decode(String.self, forKey: .currencyCode)
        institutionName = try container.decode(String.self, forKey: .institutionName)
        lastSyncedAt = try container.decodeIfPresent(String.self, forKey: .lastSyncedAt)
        status = try container.decode(AccountStatus.self, forKey: .status)
        source = try container.decodeIfPresent(AccountSource.self, forKey: .source)
        connectionProvider = try container.decodeIfPresent(ConnectionProvider.self, forKey: .connectionProvider)
        tellerEnrollmentId = try container.decodeIfPresent(String.self, forKey: .tellerEnrollmentId)
        plaidItemId = try container.decodeIfPresent(String.self, forKey: .plaidItemId)
        memberId = try container.decodeIfPresent(String.self, forKey: .memberId)
        memberName = try container.decodeIfPresent(String.self, forKey: .memberName)
        memberColor = try container.decodeIfPresent(String.self, forKey: .memberColor)
        liability = try container.decodeIfPresent(AccountCreditLiability.self, forKey: .liability)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(officialName, forKey: .officialName)
        try container.encode(type, forKey: .type)
        try container.encodeIfPresent(subtype, forKey: .subtype)
        try container.encodeIfPresent(mask, forKey: .mask)
        try container.encode(balanceCurrent, forKey: .balanceCurrent)
        try container.encodeIfPresent(balanceAvailable, forKey: .balanceAvailable)
        try container.encode(currencyCode, forKey: .currencyCode)
        try container.encode(institutionName, forKey: .institutionName)
        try container.encodeIfPresent(lastSyncedAt, forKey: .lastSyncedAt)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(source, forKey: .source)
        try container.encodeIfPresent(connectionProvider, forKey: .connectionProvider)
        try container.encodeIfPresent(tellerEnrollmentId, forKey: .tellerEnrollmentId)
        try container.encodeIfPresent(plaidItemId, forKey: .plaidItemId)
        try container.encodeIfPresent(memberId, forKey: .memberId)
        try container.encodeIfPresent(memberName, forKey: .memberName)
        try container.encodeIfPresent(memberColor, forKey: .memberColor)
        try container.encodeIfPresent(liability, forKey: .liability)
    }
}

enum AccountType: Codable, Sendable, Equatable, Hashable {
    case depository
    case credit
    case investment
    case loan
    case brokerage
    case other
    case unknown(String)

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = AccountType(rawValue: raw)
    }

    init(rawValue: String) {
        switch rawValue {
        case "depository": self = .depository
        case "credit": self = .credit
        case "investment": self = .investment
        case "loan": self = .loan
        case "brokerage": self = .brokerage
        case "other": self = .other
        default: self = .unknown(rawValue)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }

    var rawValue: String {
        switch self {
        case .depository: "depository"
        case .credit: "credit"
        case .investment: "investment"
        case .loan: "loan"
        case .brokerage: "brokerage"
        case .other: "other"
        case .unknown(let value): value
        }
    }
}

enum AccountStatus: String, Codable, Sendable, Equatable {
    case active
    case error
    case reauthRequired = "reauth_required"
}

enum AccountSource: String, Codable, Sendable, Equatable {
    case `import`
    case plaid
    case teller
    case snaptrade
}

enum ConnectionProvider: String, Codable, Sendable, Equatable {
    case `import`
    case plaid
    case teller
    case snaptrade
}

struct AccountsResponse: Codable, Sendable {
    let accounts: [Account]
}

struct PlaidLinkTokenResponse: Codable, Sendable {
    let linkToken: String
}

struct PlaidExchangeResponse: Codable, Sendable {
    let itemId: String
    let institutionName: String
    let accountsSynced: Int
    let transactionsAdded: Int
    let message: String
}

struct PlaidSyncResponse: Codable, Sendable {
    let status: String
    let itemId: String
    let institutionName: String
    let accountsSynced: Int
    let added: Int
    let modified: Int
    let removed: Int
}

struct PlaidSyncAllResponse: Codable, Sendable {
    struct Failure: Codable, Sendable {
        let itemId: String
        let institutionName: String?
        let message: String
    }

    let status: String
    let itemsSynced: Int
    let added: Int
    let modified: Int
    let removed: Int
    let message: String?
    let failures: [Failure]?
}

struct TellerConnectConfig: Codable, Sendable {
    let applicationId: String
    let environment: String
    let products: [String]
}

struct TellerExchangeResponse: Codable, Sendable {
    let enrollmentId: String
    let institutionName: String
    let accountsSynced: Int
    let transactionsAdded: Int
    let message: String
}

struct DeleteAccountResponse: Codable, Sendable {
    let id: String
    let name: String
    let mask: String?
    let transactionsDeleted: Int
    let plaidItemDisconnected: Bool
}
