import Foundation

struct Transaction: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let accountId: String
    let accountMask: String?
    let date: String
    let name: String
    let merchantName: String?
    let amount: String
    let currencyCode: String
    let category: String
    let subCategory: String?
    let transactionType: TransactionType
    let isTransfer: Bool
    let pending: Bool
    let memberId: String?
    let memberName: String?
    let memberColor: String?
}

enum TransactionType: String, Codable, Sendable {
    case expense
    case income
    case transfer
}

struct PaginatedTransactions: Codable, Sendable {
    let items: [Transaction]
    let nextCursor: String?
}

struct TransactionFilters: Sendable {
    var month: String?
    var category: String?
    var subCategory: String?
    var categorizationStatus: CategorizationStatus?
    var accountId: String?
    var memberId: String?
    var scope: ViewScope?
    var query: String?
    var type: TransactionType?
    var sort: TransactionSort?
    var limit: Int?
    var cursor: String?

    func queryItems() -> [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let month { items.append(.init(name: "month", value: month)) }
        if let category { items.append(.init(name: "category", value: category)) }
        if let subCategory { items.append(.init(name: "subCategory", value: subCategory)) }
        if let categorizationStatus {
            items.append(.init(name: "categorizationStatus", value: categorizationStatus.rawValue))
        }
        if let accountId { items.append(.init(name: "accountId", value: accountId)) }
        if let memberId { items.append(.init(name: "memberId", value: memberId)) }
        if let scope { items.append(.init(name: "scope", value: scope.rawValue)) }
        if let query, !query.isEmpty { items.append(.init(name: "q", value: query)) }
        if let type { items.append(.init(name: "type", value: type.rawValue)) }
        if let sort { items.append(.init(name: "sort", value: sort.rawValue)) }
        if let limit { items.append(.init(name: "limit", value: String(limit))) }
        if let cursor { items.append(.init(name: "cursor", value: cursor)) }
        return items
    }
}

enum CategorizationStatus: String, Sendable, CaseIterable {
    case uncategorized
    case missingSubcategory = "missing_subcategory"
    case needsReview = "needs_review"

    var label: String {
        switch self {
        case .uncategorized: "Uncategorized"
        case .missingSubcategory: "Missing subcategory"
        case .needsReview: "Needs review"
        }
    }
}

enum TransactionSort: String, Sendable, CaseIterable {
    case dateDesc = "date_desc"
    case dateAsc = "date_asc"
    case amountDesc = "amount_desc"
    case amountAsc = "amount_asc"
    case nameAsc = "name_asc"
    case categoryAsc = "category_asc"

    var label: String {
        switch self {
        case .dateDesc: "Newest"
        case .dateAsc: "Oldest"
        case .amountDesc: "Biggest first"
        case .amountAsc: "Smallest first"
        case .nameAsc: "Name A–Z"
        case .categoryAsc: "Category A–Z"
        }
    }
}

struct UpdateTransactionCategoryResponse: Codable, Sendable {
    struct TransactionPatch: Codable, Sendable {
        let id: String
        let category: String
        let subCategory: String?
        let merchantKey: String
    }

    let transaction: TransactionPatch
    let merchantTransactionsUpdated: Int
}

enum ViewScope: String, Codable, Sendable {
    case all
    case household
    case personal
}
