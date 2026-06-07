import Foundation

enum BudgetSource: String, Codable, Sendable {
    case user
    case suggested
}

enum BudgetClass: String, Codable, Sendable {
    case essential
    case discretionary
}

enum GoalKind: String, Codable, Sendable {
    case emergency
    case debt
    case sinking
    case surplus
    case custom
}

enum GoalStatus: String, Codable, Sendable {
    case active
    case achieved
    case dismissed
}

enum GoalSource: String, Codable, Sendable {
    case user
    case suggested
}

enum SuggestionConfidence: String, Codable, Sendable {
    case low
    case medium
    case high
}

struct BudgetItem: Codable, Identifiable, Sendable {
    var id: String { storedId ?? category }
    let storedId: String?
    let category: String
    let emoji: String?
    let color: String?
    let spent: String
    let limit: String
    let source: BudgetSource
    let budgetClass: BudgetClass?
    let rationale: String?
    let confidence: SuggestionConfidence?

    enum CodingKeys: String, CodingKey {
        case storedId = "id"
        case category, emoji, color, spent, limit, source, rationale, confidence
        case budgetClass = "class"
    }
}

struct GoalItem: Codable, Identifiable, Sendable {
    var id: String { storedId ?? name }
    let storedId: String?
    let name: String
    let emoji: String?
    let color: String?
    let target: String
    let current: String
    let deadline: String?
    let kind: GoalKind
    let status: GoalStatus
    let source: GoalSource
    let rationale: String?
    let confidence: SuggestionConfidence?
    let monthlySetAside: String?
    let accountId: String?

    enum CodingKeys: String, CodingKey {
        case storedId = "id"
        case name, emoji, color, target, current, deadline, kind, status, source
        case rationale, confidence, monthlySetAside, accountId
    }
}

struct BudgetRow: Codable, Identifiable, Sendable {
    let id: String
    let category: String
    let periodMonth: String
    let emoji: String?
    let color: String?
    let limit: String
    let source: BudgetSource
    let budgetClass: BudgetClass?

    enum CodingKeys: String, CodingKey {
        case id, category, periodMonth, emoji, color, limit, source
        case budgetClass = "class"
    }
}

struct GoalRow: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let emoji: String?
    let color: String?
    let target: String
    let current: String
    let deadline: String?
    let kind: GoalKind
    let status: GoalStatus
    let source: GoalSource
    let accountId: String?
}

struct BudgetsResponse: Codable, Sendable {
    let periodMonth: String
    let safeToSpend: String
    let daysRemaining: Int
    let isLive: Bool
    let budgets: [BudgetItem]
    let suggestedBudgets: [BudgetItem]
    let goals: [GoalItem]
    let suggestedGoals: [GoalItem]
}

struct UpsertBudgetInput: Encodable, Sendable {
    let category: String
    let periodMonth: String
    let limit: Double
    var emoji: String?
    var color: String?
    var source: BudgetSource?
    var budgetClass: BudgetClass?

    enum CodingKeys: String, CodingKey {
        case category, periodMonth, limit, emoji, color, source
        case budgetClass = "class"
    }
}

struct PatchBudgetInput: Encodable, Sendable {
    var limit: Double?
    var emoji: String?
    var color: String?
    var budgetClass: BudgetClass?

    enum CodingKeys: String, CodingKey {
        case limit, emoji, color
        case budgetClass = "class"
    }
}

struct CreateGoalInput: Encodable, Sendable {
    let name: String
    let target: Double
    var current: Double?
    var deadline: String?
    var emoji: String?
    var color: String?
    var kind: GoalKind?
    var status: GoalStatus?
    var source: GoalSource?
    var accountId: String?
}

struct PatchGoalInput: Encodable, Sendable {
    var name: String?
    var target: Double?
    var current: Double?
    var deadline: String?
    var emoji: String?
    var color: String?
    var kind: GoalKind?
    var status: GoalStatus?
    var accountId: String?
}

struct RecurringItem: Codable, Identifiable, Sendable {
    var id: String { "\(merchantName)-\(cadence)" }
    let merchantName: String
    let category: String
    let kind: String
    let amount: String
    let cadence: String
    let nextChargeDate: String?
    let lastChargeDate: String?
    let previousAmount: String?
    let priceChanged: Bool
    let status: String
    let brandColor: String?
}

struct CostAudit: Codable, Identifiable, Sendable {
    let id: String
    let type: String
    let emoji: String
    let title: String
    let monthly: String
    let annual: String
    let opportunityCost10y: String
    let rationale: String
    let action: String
    let savingsEstimate: String
    let confidence: Double
}

struct RecurringResponse: Codable, Sendable {
    struct FeeLeak: Codable, Identifiable, Sendable {
        let id: String
        let label: String
        let source: String
        let count: Int
        let total: String
        let fixable: Bool
    }

    struct HabitLeak: Codable, Identifiable, Sendable {
        let id: String
        let emoji: String?
        let label: String
        let monthly: String
    }

    struct Leaks: Codable, Sendable {
        let fees: [FeeLeak]
        let habits: [HabitLeak]
        let audits: [CostAudit]
    }

    let monthlyTotal: String
    let annualTotal: String
    let activeCount: Int
    let priceChanges: Int
    let isLive: Bool
    let subscriptions: Page<RecurringItem>
    let bills: Page<RecurringItem>
    let leaks: Leaks
}

struct CalendarResponse: Codable, Sendable {
    struct Event: Codable, Identifiable, Sendable {
        var id: String { "\(day)-\(label)" }
        let day: Int
        let type: String
        let label: String
        let amount: String
    }

    struct HeatDay: Codable, Identifiable, Sendable {
        var id: String { String(day) }
        let day: Int
        let level: Int
    }

    struct Totals: Codable, Sendable {
        let income: String
        let bills: String
    }

    let month: String
    let events: [Event]
    let heat: [HeatDay]
    let totals: Totals
    let safeToSpendToday: String
}

struct ForecastResponse: Codable, Sendable {
    struct Day: Codable, Identifiable, Sendable {
        var id: String { date }
        let date: String
        let weekday: String
        let weather: String
        let projectedBalance: String
        let note: String
    }

    let days: [Day]
    let comfortFloor: String
    let minBalance: String
    let lowestDay: String
    let nextClearDate: String
    let recommendation: String
}
