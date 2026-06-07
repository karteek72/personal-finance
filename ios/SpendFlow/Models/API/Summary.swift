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
