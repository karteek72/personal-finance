import Foundation

struct NetWorthResponse: Codable, Sendable {
    struct Current: Codable, Sendable {
        let netWorth: String
        let totalAssets: String
        let totalLiabilities: String
        let accountCount: Int
    }

    struct Bucket: Codable, Sendable {
        let total: String
        let accountCount: Int
    }

    struct Breakdown: Codable, Sendable {
        let depository: Bucket
        let investment: Bucket
        let credit: Bucket
    }

    struct TrendPoint: Codable, Identifiable, Sendable {
        var id: String { month }
        let month: String
        let netWorth: String
    }

    let current: Current
    let breakdown: Breakdown
    let trend: [TrendPoint]
}

struct InvestmentHolding: Codable, Identifiable, Sendable {
    var id: String { "\(ticker)-\(assetType)" }
    let ticker: String
    let name: String
    let sector: String?
    let assetType: String
    let quantity: Double
    let costBasis: String
    let currentPrice: String
    let value: String
    let gainLoss: String
    let gainLossPercent: Double
    let underlyingTicker: String?
    let optionType: String?
    let expirationLabel: String?
}

struct InvestmentPosition: Codable, Identifiable, Sendable {
    var id: String { holdingId }
    let holdingId: String
    let accountId: String
    let accountName: String
    let institutionName: String
    let accountMask: String?
    let ticker: String
    let name: String
    let sector: String?
    let assetType: String
    let quantity: Double
    let costBasis: String
    let currentPrice: String
    let value: String
    let gainLoss: String
    let gainLossPercent: Double
    let underlyingTicker: String?
    let optionType: String?
    let expirationLabel: String?
}

struct StockAggregateLot: Codable, Sendable {
    let accountId: String
    let accountName: String
    let quantity: Double
    let value: String
    let costBasis: String
}

struct StockAggregate: Codable, Identifiable, Sendable {
    var id: String { ticker }
    let ticker: String
    let name: String
    let sector: String?
    let assetType: String
    let totalQuantity: Double
    let currentPrice: String
    let totalValue: String
    let totalCost: String
    let gainLoss: String
    let gainLossPercent: Double
    let accountCount: Int
    let lots: [StockAggregateLot]
}

struct PortfolioBreakdown: Codable, Sendable {
    let stocksValue: String
    let optionsValue: String
    let otherValue: String
    let stocksSharePercent: Double
    let optionsSharePercent: Double
    let stockPositionCount: Int
    let optionPositionCount: Int
    let totalPositionCount: Int
}

struct InvestmentsResponse: Codable, Sendable {
    struct AccountSummary: Codable, Identifiable, Sendable {
        var id: String { accountId }
        let accountId: String
        let name: String
        let institutionName: String
        let subtype: String?
        let value: String
    }

    struct BehavioralAlert: Codable, Identifiable, Sendable {
        var id: String { title }
        let type: String
        let title: String
        let desc: String
    }

    struct InvestmentHistory: Codable, Sendable {
        let lookbackYears: Int
        let totalContributed: String
        let estimatedValueToday: String
        let currentPortfolioValue: String
        let monthlyAverageInvest: String
        let transactionCount: Int
        let buyTransactionCount: Int
    }

    struct MonthlyActivity: Codable, Sendable {
        let cashContributions: String
        let purchaseDeployments: String
        let totalDeployed: String
    }

    let portfolioValue: String
    let totalCostBasis: String
    let totalGainLoss: String
    let totalGainLossPercent: Double
    let accounts: [AccountSummary]
    let holdings: Page<InvestmentHolding>
    let positions: Page<InvestmentPosition>
    let stockAggregates: [StockAggregate]
    let optionPositions: [InvestmentPosition]
    let portfolioBreakdown: PortfolioBreakdown
    let behavioralAlerts: [BehavioralAlert]
    let investmentHistory: InvestmentHistory?
    let monthlyActivity: MonthlyActivity?
}

struct FireProjection: Codable, Sendable {
    let fireNumber: String
    let yearsToFire: Int
    let fireAge: Int
    let investingRate: Double
    let curve: [Double]
}

struct FireAssumptions: Codable, Sendable {
    let realReturn: Double
    let withdrawalRate: Double
    let inflationHandledViaRealReturn: Bool
}

struct FireResponse: Codable, Sendable {
    let currentAge: Int
    let isDefaultAge: Bool
    let currentNetWorth: String
    let investableAssets: String?
    let monthlySpend: String
    let monthlyInvest: String
    let withdrawalRate: Double
    let realReturn: Double
    let projection: FireProjection
    let targetRetirementAge: Int?
    let targetStatus: String?
    let targetGapYears: Double?
    let requiredMonthlySavings: String?
    let inputBasis: String?
    let caveats: [String]?
    let assumptions: FireAssumptions?
}

struct FireQueryOverrides: Encodable, Sendable {
    var monthlySpend: Double?
    var monthlyInvest: Double?
    var withdrawalRate: Double?
    var realReturn: Double?
}

struct FireProfilePatch: Encodable, Sendable {
    var currentAge: Int?
    var withdrawalRate: Double?
    var realReturn: Double?
}

struct CreditCardDebtRow: Codable, Identifiable, Sendable {
    var id: String { accountId }
    let accountId: String
    let name: String
    let mask: String?
    let institutionName: String
    let balanceCurrent: String
    let liability: AccountCreditLiability?
}

struct CreditDebtSummary: Codable, Sendable {
    let totalCurrentBalance: String
    let totalStatementBalance: String
    let totalMinimumDue: String
    let totalEstimatedMonthlyInterest: String
    let overdueCount: Int
    let coverageLabel: String
    let cards: [CreditCardDebtRow]
}

struct AccountCreditLiability: Codable, Sendable {
    struct Apr: Codable, Sendable {
        let aprType: String
        let aprPercentage: String
        let balanceSubjectToApr: String?
        let interestChargeAmount: String?
    }

    let lastStatementBalance: String?
    let lastStatementIssueDate: String?
    let minimumPaymentAmount: String?
    let nextPaymentDueDate: String?
    let lastPaymentAmount: String?
    let lastPaymentDate: String?
    let isOverdue: Bool?
    let aprs: [Apr]
    let purchaseApr: String?
    let estimatedMonthlyInterest: String?
    let statementVsCurrentDelta: String?
    let daysUntilDue: Int?
    let syncedAt: String?
}
