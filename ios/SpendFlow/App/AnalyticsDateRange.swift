import Foundation

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

    static var periodLabel: String {
        "Last \(defaultMonths) months"
    }

    private static func formatLocalDate(_ date: Date) -> String {
        var calendar = Calendar.current
        calendar.timeZone = .current
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }
}
