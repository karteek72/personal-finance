import Foundation

struct WellnessResponse: Codable, Sendable {
    struct HistoryPoint: Codable, Identifiable, Sendable {
        var id: String { month }
        let month: String
        let score: Double
    }

    struct Dimension: Codable, Identifiable, Sendable {
        var id: String { name }
        let name: String
        let score: Double
        let weight: Double
        let description: String
        let trend: String
    }

    let score: Double
    let delta: Double
    let history: [HistoryPoint]
    let isLive: Bool
    let dimensions: [Dimension]
}

struct DnaResponse: Codable, Sendable {
    struct Axis: Codable, Identifiable, Sendable {
        var id: String { label }
        let label: String
        let you: Double
        let peers: Double
    }

    let archetype: String
    let narrative: String
    let peerRarity: String?
    let axes: [Axis]
    let isLive: Bool?
}

struct PatternsResponse: Codable, Sendable {
    struct DayOfWeek: Codable, Identifiable, Sendable {
        var id: String { day }
        let day: String
        let value: String
    }

    struct PatternRow: Codable, Identifiable, Sendable {
        var id: String { label }
        let label: String
        let value: String
        let description: String
        let severity: String
    }

    let dayOfWeek: [DayOfWeek]
    let patterns: Page<PatternRow>
}

struct BehavioralResponse: Codable, Sendable {
    struct Creep: Codable, Sendable {
        let months: [String]
        let income: [String]
        let spending: [String]
    }

    struct Reason: Codable, Identifiable, Sendable {
        let id: String
        let emoji: String
        let label: String
        let color: String
        let total: String
    }

    struct TaggedTransaction: Codable, Identifiable, Sendable {
        let id: String
        let merchant: String
        let amount: String
        let date: String
        let reasonId: String
    }

    struct Challenge: Codable, Identifiable, Sendable {
        let storedId: String?
        let title: String
        let goal: String
        let progressPercent: Double
        let daysRemaining: Int
        let complete: Bool
        let color: String?

        var id: String { storedId ?? title }

        enum CodingKeys: String, CodingKey {
            case storedId = "id"
            case title, goal, progressPercent, daysRemaining, complete, color
        }
    }

    struct Streak: Codable, Identifiable, Sendable {
        var id: String { label }
        let label: String
        let currentDays: Int
        let maxDays: Int
        let color: String?
    }

    let archetype: String
    let creep: Creep
    let reasons: [Reason]
    let taggedTransactions: [TaggedTransaction]
    let challenges: [Challenge]
    let streaks: [Streak]
}

struct MerchantsResponse: Codable, Sendable {
    struct Merchant: Codable, Identifiable, Sendable {
        var id: String { name }
        let name: String
        let emoji: String
        let visits: Int
        let total: String
        let trend: Double
        let trail: [Double]
    }

    struct IncomeSummary: Codable, Sendable {
        let avgMonthlyIncome: String
        let incomeStability: Double
        let sideIncomeTotal: String
        let chartYTicks: [Double]
        let maxBarTotal: Double
    }

    let merchants: [Merchant]
    let income: IncomeSeries
    let incomeSummary: IncomeSummary
    let merchantCount: Int
    let incomeSources: Int
    let isLive: Bool

    struct IncomeSeries: Codable, Sendable {
        let months: [String]
        let primary: [Double]
        let side: [Double]
    }
}

struct MerchantRow: Codable, Identifiable, Sendable {
    var id: String { name }
    let name: String
    let emoji: String
    let visits: Int
    let total: String
    let avgTransaction: String
    let share: Double
    let trend: Double
    let lastSeen: String
    let trail: [Double]
}

struct MerchantsSummary: Codable, Sendable {
    let merchantCount: Int
    let totalSpend: String
    let topMerchant: NamedAmount?
    let mostVisited: VisitedMerchant?
    let fastestGrowing: GrowingMerchant?

    struct NamedAmount: Codable, Sendable {
        let name: String
        let total: String
    }

    struct VisitedMerchant: Codable, Sendable {
        let name: String
        let visits: Int
    }

    struct GrowingMerchant: Codable, Sendable {
        let name: String
        let trend: Double
    }
}

struct MerchantsTableResponse: Codable, Sendable {
    let rows: [MerchantRow]
    let page: Int
    let pageSize: Int
    let total: Int
    let totalPages: Int
    let sort: String
    let dir: String
    let appliedFilters: [String: String]
    let summary: MerchantsSummary
    let isLive: Bool
}

struct TransactionReasonResponse: Codable, Sendable {
    let transactionId: String
    let reasonId: String?
}

struct WrappedResponse: Codable, Sendable {
    struct TopCategory: Codable, Sendable {
        let name: String
        let amount: String
    }

    struct Moment: Codable, Identifiable, Sendable {
        var id: String { label }
        let label: String
        let value: String
    }

    struct Goal: Codable, Identifiable, Sendable {
        var id: String { label }
        let label: String
        let target: String
        let pct: Double
    }

    let year: Int
    let totalSpent: String
    let transactionCount: Int
    let totalSaved: String
    let savingsRate: Double
    let peerPercentile: String?
    let archetype: String?
    let topCategory: TopCategory
    let personality: [String: Double]
    let moments: [Moment]
    let goals: [Goal]
}
