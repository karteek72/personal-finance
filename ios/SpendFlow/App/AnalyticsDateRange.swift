import Foundation
import Observation

/// Mirrors `ui/src/lib/date-ranges.ts` — rolling calendar-month window for analytics.
enum AnalyticsDateRange {
    static let defaultMonths = 12

    static func rolling(monthsBack: Int = defaultMonths, now: Date = Date()) -> (from: String, to: String) {
        var calendar = Calendar.current
        calendar.timeZone = .current

        let toDate = calendar.startOfDay(for: now)
        let toComponents = calendar.dateComponents([.year, .month], from: toDate)
        let fromMonthStart = calendar.date(
            from: DateComponents(
                year: toComponents.year,
                month: (toComponents.month ?? 1) - (monthsBack - 1),
                day: 1
            )
        ) ?? toDate

        return (formatLocalDate(fromMonthStart), formatLocalDate(toDate))
    }

    static func periodLabel(monthsBack: Int = defaultMonths) -> String {
        "Last \(monthsBack) months"
    }

    static var periodLabel: String {
        periodLabel(monthsBack: defaultMonths)
    }

    static func formatLocalDate(_ date: Date) -> String {
        var calendar = Calendar.current
        calendar.timeZone = .current
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }
}

/// User-selectable analytics window presets for summary, categories, flow, and charts.
enum AnalyticsPeriod: String, CaseIterable, Codable, Sendable {
    case thisMonth
    case threeMonths
    case twelveMonths
    case custom

    var label: String {
        switch self {
        case .thisMonth:
            "This month"
        case .threeMonths:
            "Last 3 months"
        case .twelveMonths:
            "Last 12 months"
        case .custom:
            "Custom range"
        }
    }

    func window(
        from customFrom: String? = nil,
        to customTo: String? = nil,
        now: Date = Date()
    ) -> (from: String, to: String) {
        switch self {
        case .thisMonth:
            var calendar = Calendar.current
            calendar.timeZone = .current
            let toDate = calendar.startOfDay(for: now)
            let components = calendar.dateComponents([.year, .month], from: toDate)
            let fromDate = calendar.date(from: DateComponents(
                year: components.year,
                month: components.month,
                day: 1
            )) ?? toDate
            return (AnalyticsDateRange.formatLocalDate(fromDate), AnalyticsDateRange.formatLocalDate(toDate))

        case .threeMonths:
            return AnalyticsDateRange.rolling(monthsBack: 3, now: now)

        case .twelveMonths:
            return AnalyticsDateRange.rolling(monthsBack: AnalyticsDateRange.defaultMonths, now: now)

        case .custom:
            if let customFrom, let customTo, !customFrom.isEmpty, !customTo.isEmpty {
                return (customFrom, customTo)
            }
            return AnalyticsDateRange.rolling(now: now)
        }
    }
}

@MainActor
@Observable
final class AnalyticsPeriodStore {
    private let periodKey = "spendflow.analytics.period"
    private let customFromKey = "spendflow.analytics.customFrom"
    private let customToKey = "spendflow.analytics.customTo"

    var period: AnalyticsPeriod {
        didSet { UserDefaults.standard.set(period.rawValue, forKey: periodKey) }
    }

    var customFrom: String? {
        didSet { UserDefaults.standard.set(customFrom, forKey: customFromKey) }
    }

    var customTo: String? {
        didSet { UserDefaults.standard.set(customTo, forKey: customToKey) }
    }

    var label: String {
        if period == .custom, let customFrom, let customTo {
            return "\(customFrom) – \(customTo)"
        }
        return period.label
    }

    /// Alias used by dashboard/categories/flow view models.
    var periodLabel: String { label }

    var window: (from: String, to: String) {
        period.window(from: customFrom, to: customTo)
    }

    /// Alias used by dashboard/categories/flow view models.
    var dateRange: (from: String, to: String) { window }

    init() {
        let storedPeriod = UserDefaults.standard.string(forKey: periodKey)
        period = AnalyticsPeriod(rawValue: storedPeriod ?? "") ?? .twelveMonths
        customFrom = UserDefaults.standard.string(forKey: customFromKey)
        customTo = UserDefaults.standard.string(forKey: customToKey)
    }

    func setCustomRange(from: String, to: String) {
        customFrom = from
        customTo = to
        period = .custom
    }
}
