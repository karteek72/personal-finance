import Foundation

struct TransactionSummary: Codable, Sendable {
    let totalSpent: String
    let income: String
    let netSavings: String
    let avgMonthlySpend: String
    let topCategory: TopCategory
    let ccPaymentsExcluded: String
    let savingsRate: Double
    let transactionCount: Int?
    let pendingCount: Int?
    let monthsInPeriod: Int?

    struct TopCategory: Codable, Sendable {
        let name: String
        let amount: String
    }
}

struct FlowLine: Codable, Identifiable, Sendable {
    var id: String { label }
    let label: String
    let amount: String
}

struct MoneyFlowResponse: Codable, Sendable {
    let income: FlowSection
    let bankAccounts: BankSection
    let creditCards: CreditSection
    let monthlySeries: [MonthlyFlowPoint]

    struct FlowSection: Codable, Sendable {
        let sources: Page<FlowLine>
        let total: String
    }

    struct BankSection: Codable, Sendable {
        let accounts: [FlowLine]
        let transfersOut: String
    }

    struct CreditSection: Codable, Sendable {
        let accounts: [FlowLine]
        let totalCharges: String
    }

    struct MonthlyFlowPoint: Codable, Identifiable, Sendable {
        var id: String { month }
        let month: String
        let income: String
        let expenses: String
        let net: String
    }
}

struct CategoryTotal: Codable, Identifiable, Sendable {
    var id: String { name }
    let name: String
    let amount: String
    let percentage: Double
    let deltaVsPriorMonth: Double
    let subcategories: [SubCategoryTotal]?
}

struct SubCategoryTotal: Codable, Identifiable, Sendable {
    var id: String { name }
    let name: String
    let amount: String
    let percentage: Double
}

struct CategoriesResponse: Codable, Sendable {
    let categories: [CategoryTotal]
}

struct CategoryTrend: Codable, Identifiable, Sendable {
    var id: String { name }
    let name: String
    let months: [TrendMonth]

    struct TrendMonth: Codable, Sendable {
        let month: String
        let amount: String
    }
}

struct TrendsResponse: Codable, Sendable {
    let trends: [CategoryTrend]
}

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
