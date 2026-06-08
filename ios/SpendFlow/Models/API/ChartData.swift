import Foundation

struct ChartMonthlyPoint: Codable, Identifiable, Sendable {
    var id: String { month }
    let month: String
    let expenses: String
    let income: String
    let net: String
}

struct ChartYearlyPoint: Codable, Identifiable, Sendable {
    var id: String { year }
    let year: String
    let expenses: String
    let income: String
    let net: String
}

struct ChartCategorySlice: Codable, Identifiable, Sendable {
    var id: String { name }
    let name: String
    let amount: String
    let percentage: Double
}

struct ChartAccountSlice: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let amount: String
    let percentage: Double
}

struct ChartMemberSlice: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let color: String
    let amount: String
    let percentage: Double
}

struct ChartDataTotals: Codable, Sendable {
    let expenses: String
    let income: String
    let net: String
}

struct ChartDataFilters: Sendable {
    var from: String?
    var to: String?
    var accountId: String?
    var category: String?
    var scope: ViewScope?
    var memberId: String?

    init(from: String? = nil, to: String? = nil) {
        self.from = from
        self.to = to
    }
}

struct ChartDataResponse: Codable, Sendable {
    let monthly: [ChartMonthlyPoint]
    let yearly: [ChartYearlyPoint]
    let byCategory: [ChartCategorySlice]
    let bySubCategory: [ChartCategorySlice]
    let byAccount: [ChartAccountSlice]
    let byMember: [ChartMemberSlice]
    let categoryTrends: [CategoryTrend]
    let totals: ChartDataTotals
}
