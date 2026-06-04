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
    let plaidItemId: String?
    let memberId: String?
    let memberName: String?
    let memberColor: String?
}

enum AccountType: String, Codable, Sendable {
    case depository
    case credit
    case investment
}

enum AccountStatus: String, Codable, Sendable {
    case active
    case error
    case reauthRequired = "reauth_required"
}

enum AccountSource: String, Codable, Sendable {
    case `import`
    case plaid
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

struct DeleteAccountResponse: Codable, Sendable {
    let id: String
    let name: String
    let mask: String
    let transactionsDeleted: Int
    let plaidItemDisconnected: Bool
}
