import Foundation

// MARK: - List query

struct ListQuery: Sendable {
    var page: Int?
    var pageSize: Int?
    var sort: String?
    var dir: SortDirection?
    var q: String?
    var from: String?
    var to: String?
    var accountId: String?

    enum SortDirection: String, Sendable {
        case asc
        case desc
    }

    func queryItems() -> [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let page { items.append(.init(name: "page", value: String(page))) }
        if let pageSize { items.append(.init(name: "pageSize", value: String(pageSize))) }
        if let sort { items.append(.init(name: "sort", value: sort)) }
        if let dir { items.append(.init(name: "dir", value: dir.rawValue)) }
        if let q, !q.isEmpty { items.append(.init(name: "q", value: q)) }
        if let from { items.append(.init(name: "from", value: from)) }
        if let to { items.append(.init(name: "to", value: to)) }
        if let accountId { items.append(.init(name: "accountId", value: accountId)) }
        return items
    }
}

// MARK: - Pagination envelope

struct Page<Row: Codable & Sendable>: Codable, Sendable {
    let rows: [Row]
    let page: Int
    let pageSize: Int
    let total: Int
    let totalPages: Int
    let sort: String
    let dir: String
    let appliedFilters: [String: String]
}

// MARK: - Metric envelope

enum MetricUnit: String, Codable, Sendable {
    case USD
    case percent
    case months
    case ratio
    case score
}

enum MetricClass: String, Codable, Sendable {
    case descriptive
    case diagnostic
    case predictive
    case prescriptive
}

enum MetricBasis: String, Codable, Sendable {
    case factual
    case heuristic
    case external
}

enum TrendDirection: String, Codable, Sendable {
    case up
    case down
    case flat
}

struct MetricTrend: Codable, Sendable {
    let delta: String
    let deltaPct: Double
    let direction: TrendDirection
    let comparison: String
}

struct MetricEnvelope: Codable, Sendable {
    let value: String
    let unit: MetricUnit
    let grain: String
    let asOf: String
    let `class`: MetricClass
    let basis: MetricBasis
    let confidence: Double
    let trend: MetricTrend?
    let caveats: [String]?
}

struct RecomputeAnalyticsResponse: Codable, Sendable {
    struct Step: Codable, Sendable {
        let name: String
        let status: String
    }

    let steps: [Step]
    let message: String?
}
