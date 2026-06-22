import Foundation

/// Dashboard-only period modes — mirrors web `DashboardPeriodMode`.
enum DashboardPeriodMode: String, CaseIterable, Sendable {
    case rolling
    case month

    var label: String {
        switch self {
        case .rolling: "12 months"
        case .month: "Month"
        }
    }
}

enum DashboardDateRange {
    static func currentMonthKey(now: Date = Date()) -> String {
        var calendar = Calendar.current
        calendar.timeZone = .current
        let components = calendar.dateComponents([.year, .month], from: now)
        return String(format: "%04d-%02d", components.year ?? 0, components.month ?? 0)
    }

    static func monthBounds(_ monthKey: String) -> (from: String, to: String) {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]) else {
            return AnalyticsDateRange.rolling()
        }

        var calendar = Calendar.current
        calendar.timeZone = .current
        let fromDate = calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
        let range = calendar.range(of: .day, in: .month, for: fromDate) ?? 1..<29
        let toDate = calendar.date(from: DateComponents(year: year, month: month, day: range.upperBound - 1)) ?? fromDate
        return (AnalyticsDateRange.formatLocalDate(fromDate), AnalyticsDateRange.formatLocalDate(toDate))
    }

    static func resolve(
        mode: DashboardPeriodMode,
        monthKey: String,
        now: Date = Date()
    ) -> (from: String, to: String) {
        switch mode {
        case .rolling:
            return AnalyticsDateRange.rolling(now: now)
        case .month:
            return monthBounds(monthKey)
        }
    }

    static func periodLabel(mode: DashboardPeriodMode, monthKey: String) -> String {
        switch mode {
        case .rolling:
            return AnalyticsDateRange.periodLabel
        case .month:
            let parts = monthKey.split(separator: "-")
            guard parts.count == 2,
                  let year = Int(parts[0]),
                  let month = Int(parts[1]) else {
                return monthKey
            }
            var calendar = Calendar.current
            calendar.timeZone = .current
            let date = calendar.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
            let formatter = DateFormatter()
            formatter.dateFormat = "MMMM yyyy"
            return formatter.string(from: date)
        }
    }

    static func recentMonthKeys(count: Int = 24, now: Date = Date()) -> [String] {
        let calendar = Calendar.current
        return (0..<count).compactMap { offset in
            guard let date = calendar.date(byAdding: .month, value: -offset, to: now) else { return nil }
            let components = calendar.dateComponents([.year, .month], from: date)
            return String(format: "%04d-%02d", components.year ?? 0, components.month ?? 0)
        }
    }

    static func monthLabel(_ monthKey: String) -> String {
        periodLabel(mode: .month, monthKey: monthKey)
    }
}
