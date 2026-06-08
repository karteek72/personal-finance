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

enum PositionKindFilter: String, Sendable {
    case all
    case stocks
    case options
}

struct PortfolioSideSummary: Codable, Sendable {
    let count: Int
    let value: String
    let sharePercent: Double

    static let empty = PortfolioSideSummary(count: 0, value: "0.00", sharePercent: 0)
}

struct PortfolioPerformer: Codable, Sendable {
    let ticker: String
    let name: String
    let gainLoss: String
    let gainLossPercent: Double
}

struct PortfolioConcentration: Codable, Sendable {
    let largestPositionWeight: Double
    let top5Weight: Double
    let hhi: Double

    static let empty = PortfolioConcentration(largestPositionWeight: 0, top5Weight: 0, hhi: 0)
}

struct PortfolioSectorAllocation: Codable, Identifiable, Sendable {
    var id: String { sector }
    let sector: String
    let value: String
    let sharePercent: Double
}

struct PortfolioUnrealizedSide: Codable, Sendable {
    let total: String
    let positionCount: Int

    static let empty = PortfolioUnrealizedSide(total: "0.00", positionCount: 0)
}

struct PortfolioCostBasisCompleteness: Codable, Sendable {
    let scored: Int
    let total: Int
    let percent: Double

    static let empty = PortfolioCostBasisCompleteness(scored: 0, total: 0, percent: 0)
}

struct PortfolioAnalytics: Codable, Sendable {
    let winners: PortfolioSideSummary
    let losers: PortfolioSideSummary
    let winRate: Double
    let bestPerformer: PortfolioPerformer?
    let worstPerformer: PortfolioPerformer?
    let bestPerformerByDollar: PortfolioPerformer?
    let worstPerformerByDollar: PortfolioPerformer?
    let concentration: PortfolioConcentration
    let sectorAllocation: [PortfolioSectorAllocation]
    let unrealizedProfit: PortfolioUnrealizedSide
    let unrealizedLoss: PortfolioUnrealizedSide
    let costBasisCompleteness: PortfolioCostBasisCompleteness
    let caveats: [String]

    static let empty = PortfolioAnalytics(
        winners: .empty,
        losers: .empty,
        winRate: 0,
        bestPerformer: nil,
        worstPerformer: nil,
        bestPerformerByDollar: nil,
        worstPerformerByDollar: nil,
        concentration: .empty,
        sectorAllocation: [],
        unrealizedProfit: .empty,
        unrealizedLoss: .empty,
        costBasisCompleteness: .empty,
        caveats: []
    )
}

struct PortfolioValueTrend: Codable, Sendable {
    struct Point: Codable, Identifiable, Sendable {
        var id: String { month }
        let month: String
        let value: String
    }

    let points: [Point]
    let granularity: String
    let caveats: [String]

    static let empty = PortfolioValueTrend(points: [], granularity: "monthly", caveats: [])
}

enum PruneLosersMomentumSignal: String, Codable, Sendable {
    case improving
    case deteriorating
    case neutral
}

enum PruneLosersClassification: String, Codable, Sendable {
    case cutCandidate = "cut-candidate"
    case holdRecover = "hold-recover"
    case winner
    case unscored
}

struct PruneLosersHolding: Codable, Identifiable, Sendable {
    var id: String { holdingId }
    let holdingId: String
    let ticker: String
    let name: String
    let value: String
    let gainLoss: String
    let gainLossPercent: Double
    let momentumScore: Double
    let momentumSignal: PruneLosersMomentumSignal
    let classification: PruneLosersClassification
}

struct PruneLosersWhatIf: Codable, Sendable {
    let capitalFreed: String
    let realizedLoss: String
    let harvestableLoss: String
    let projectedUpliftLow: String
    let projectedUpliftHigh: String
}

struct PruneLosersResponse: Codable, Sendable {
    let available: Bool
    let confidence: Double
    let caveats: [String]
    let cutCandidates: [PruneLosersHolding]
    let holdRecover: [PruneLosersHolding]
    let whatIf: PruneLosersWhatIf?

    static let empty = PruneLosersResponse(
        available: false,
        confidence: 0,
        caveats: [],
        cutCandidates: [],
        holdRecover: [],
        whatIf: nil
    )
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
        let currentPortfolioValue: String
        let totalCostBasis: String
        let unrealizedGain: String
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
    let portfolioAnalytics: PortfolioAnalytics
    let portfolioValueTrend: PortfolioValueTrend
    let pruneLosers: PruneLosersResponse
    let accounts: [AccountSummary]
    let holdings: Page<InvestmentHolding>
    let positions: Page<InvestmentPosition>
    let stockAggregates: [StockAggregate]
    let optionPositions: [InvestmentPosition]
    let portfolioBreakdown: PortfolioBreakdown
    let behavioralAlerts: [BehavioralAlert]
    let investmentHistory: InvestmentHistory?
    let monthlyActivity: MonthlyActivity?

    enum CodingKeys: String, CodingKey {
        case portfolioValue, totalCostBasis, totalGainLoss, totalGainLossPercent
        case portfolioAnalytics, portfolioValueTrend, pruneLosers
        case accounts, holdings, positions, stockAggregates, optionPositions
        case portfolioBreakdown, behavioralAlerts, investmentHistory, monthlyActivity
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        portfolioValue = try container.decode(String.self, forKey: .portfolioValue)
        totalCostBasis = try container.decode(String.self, forKey: .totalCostBasis)
        totalGainLoss = try container.decode(String.self, forKey: .totalGainLoss)
        totalGainLossPercent = try container.decode(Double.self, forKey: .totalGainLossPercent)
        portfolioAnalytics = try container.decodeIfPresent(PortfolioAnalytics.self, forKey: .portfolioAnalytics) ?? .empty
        portfolioValueTrend = try container.decodeIfPresent(PortfolioValueTrend.self, forKey: .portfolioValueTrend) ?? .empty
        pruneLosers = try container.decodeIfPresent(PruneLosersResponse.self, forKey: .pruneLosers) ?? .empty
        accounts = try container.decode([AccountSummary].self, forKey: .accounts)
        holdings = try container.decode(Page<InvestmentHolding>.self, forKey: .holdings)
        positions = try container.decode(Page<InvestmentPosition>.self, forKey: .positions)
        stockAggregates = try container.decode([StockAggregate].self, forKey: .stockAggregates)
        optionPositions = try container.decode([InvestmentPosition].self, forKey: .optionPositions)
        portfolioBreakdown = try container.decode(PortfolioBreakdown.self, forKey: .portfolioBreakdown)
        behavioralAlerts = try container.decode([BehavioralAlert].self, forKey: .behavioralAlerts)
        investmentHistory = try container.decodeIfPresent(InvestmentHistory.self, forKey: .investmentHistory)
        monthlyActivity = try container.decodeIfPresent(MonthlyActivity.self, forKey: .monthlyActivity)
    }
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

struct AccountCreditLiability: Codable, Sendable, Equatable {
    struct Apr: Codable, Sendable, Equatable {
        let aprType: String
        let aprPercentage: String
        let balanceSubjectToApr: String?
        let interestChargeAmount: String?

        enum CodingKeys: String, CodingKey {
            case aprType, aprPercentage, balanceSubjectToApr, interestChargeAmount
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            aprType = try container.decode(String.self, forKey: .aprType)
            aprPercentage = try APIDecoding.decodeMoney(from: container, forKey: .aprPercentage)
            balanceSubjectToApr = try APIDecoding.decodeOptionalMoney(from: container, forKey: .balanceSubjectToApr)
            interestChargeAmount = try APIDecoding.decodeOptionalMoney(from: container, forKey: .interestChargeAmount)
        }
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

    enum CodingKeys: String, CodingKey {
        case lastStatementBalance, lastStatementIssueDate, minimumPaymentAmount
        case nextPaymentDueDate, lastPaymentAmount, lastPaymentDate, isOverdue, aprs
        case purchaseApr, estimatedMonthlyInterest, statementVsCurrentDelta
        case daysUntilDue, syncedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        lastStatementBalance = try APIDecoding.decodeOptionalMoney(from: container, forKey: .lastStatementBalance)
        lastStatementIssueDate = try container.decodeIfPresent(String.self, forKey: .lastStatementIssueDate)
        minimumPaymentAmount = try APIDecoding.decodeOptionalMoney(from: container, forKey: .minimumPaymentAmount)
        nextPaymentDueDate = try container.decodeIfPresent(String.self, forKey: .nextPaymentDueDate)
        lastPaymentAmount = try APIDecoding.decodeOptionalMoney(from: container, forKey: .lastPaymentAmount)
        lastPaymentDate = try container.decodeIfPresent(String.self, forKey: .lastPaymentDate)
        isOverdue = try container.decodeIfPresent(Bool.self, forKey: .isOverdue)
        aprs = try container.decode([Apr].self, forKey: .aprs)
        purchaseApr = try APIDecoding.decodeOptionalMoney(from: container, forKey: .purchaseApr)
        estimatedMonthlyInterest = try APIDecoding.decodeOptionalMoney(from: container, forKey: .estimatedMonthlyInterest)
        statementVsCurrentDelta = try APIDecoding.decodeOptionalMoney(from: container, forKey: .statementVsCurrentDelta)
        daysUntilDue = try container.decodeIfPresent(Int.self, forKey: .daysUntilDue)
        syncedAt = try container.decodeIfPresent(String.self, forKey: .syncedAt)
    }
}
