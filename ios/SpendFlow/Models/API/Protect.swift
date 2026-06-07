import Foundation

struct InflationResponse: Codable, Sendable {
    struct CategoryRow: Codable, Identifiable, Sendable {
        var id: String { name }
        let name: String
        let share: Double
        let inflation: Double
        let severity: String
    }

    let personalRate: Double
    let nationalCpi: Double
    let salaryRaise: Double
    let nominalSavingsRate: Double
    let realSavingsRate: Double
    let realRaise: Double
    let powerLoss: String
    let salary: String
    let breakEvenSalary: String
    let targetSalary: String
    let categories: Page<CategoryRow>
}

struct ResilienceResponse: Codable, Sendable {
    struct Scenario: Codable, Identifiable, Sendable {
        let id: String
        let name: String
        let emoji: String?
        let shockAmount: String
        let shockType: String
        let monthsCovered: Double
        let recommendedMonths: Double
        let detail: String?
    }

    let liquidCash: String
    let monthlyBurn: String
    let runwayMonths: Double
    let immunityScore: Double
    let scenarios: [Scenario]
}
