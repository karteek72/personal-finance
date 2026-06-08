import SwiftUI

/// Yearly + monthly income/expense/net strips — mirrors web `CashFlowOverviewStrips`.
struct CashFlowOverviewStrips: View {
    let monthly: [ChartMonthlyPoint]
    let yearly: [ChartYearlyPoint]
    var periodTitle: String = AnalyticsDateRange.periodLabel()
    var accountFiltered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if yearly.count >= 2 {
                CashFlowStripSection(
                    title: yearlyTitle,
                    subtitle: accountFiltered ? "· filtered by account" : nil,
                    points: yearly.reversed().map { point in
                        CashFlowStripPoint(
                            id: point.year,
                            label: point.year,
                            income: point.income,
                            expenses: point.expenses,
                            net: point.net
                        )
                    }
                )
            }

            if !monthly.isEmpty {
                CashFlowStripSection(
                    title: periodTitle,
                    subtitle: accountFiltered ? "· filtered by account" : nil,
                    points: monthly.reversed().map { point in
                        CashFlowStripPoint(
                            id: point.month,
                            label: shortMonthLabel(point.month),
                            income: point.income,
                            expenses: point.expenses,
                            net: point.net
                        )
                    }
                )
            }
        }
    }

    private var yearlyTitle: String {
        let years = yearly.map(\.year).sorted()
        guard let first = years.first, let last = years.last else {
            return "By year"
        }
        let range = first == last ? first : "\(first)–\(last)"
        return "By year · \(range)"
    }

    private func shortMonthLabel(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count >= 2,
              let year = Int(parts[0]),
              let monthNum = Int(parts[1]),
              monthNum >= 1, monthNum <= 12 else {
            return month
        }
        let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        let shortYear = year % 100
        return "\(names[monthNum - 1]) '\(String(format: "%02d", shortYear))"
    }
}

private struct CashFlowStripPoint: Identifiable {
    let id: String
    let label: String
    let income: String
    let expenses: String
    let net: String
}

private struct CashFlowStripSection: View {
    let title: String
    var subtitle: String?
    let points: [CashFlowStripPoint]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 4) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .tracking(0.6)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(SpendFlowTheme.textMuted.opacity(0.8))
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(points) { point in
                        CashFlowPeriodCard(point: point, maxScale: maxScale)
                    }
                }
            }
        }
    }

    private var maxScale: Double {
        points.reduce(0) { maxValue, point in
            max(
                maxValue,
                AnalyticsUI.parseAmount(point.income),
                AnalyticsUI.parseAmount(point.expenses)
            )
        }
    }
}

private struct CashFlowPeriodCard: View {
    let point: CashFlowStripPoint
    let maxScale: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(point.label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
                .tracking(0.5)

            cashRow(label: "Income", amount: point.income, color: SpendFlowTheme.success, width: incomeWidth)
            cashRow(label: "Spent", amount: point.expenses, color: SpendFlowTheme.danger, width: expenseWidth)

            Divider().opacity(0.5)

            HStack {
                Text("Net")
                    .font(.system(size: 10))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Spacer()
                MoneyText(amount: point.net, font: .subheadline.weight(.bold))
                    .foregroundStyle(netColor)
            }
        }
        .padding(14)
        .frame(minWidth: 144)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.6), lineWidth: 1)
        )
    }

    private var incomeWidth: Double {
        barWidth(for: AnalyticsUI.parseAmount(point.income))
    }

    private var expenseWidth: Double {
        barWidth(for: AnalyticsUI.parseAmount(point.expenses))
    }

    private var netColor: Color {
        MoneyFormatter.isNonNegative(point.net) ? SpendFlowTheme.success : SpendFlowTheme.danger
    }

    private func barWidth(for value: Double) -> Double {
        guard maxScale > 0 else { return 0 }
        return min(1, value / maxScale)
    }

    private func cashRow(label: String, amount: String, color: Color, width: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.system(size: 10))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Spacer()
                MoneyText(amount: amount, font: .caption2.weight(.semibold))
                    .foregroundStyle(color)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(SpendFlowTheme.border.opacity(0.4))
                    Capsule()
                        .fill(color)
                        .frame(width: geo.size.width * width)
                }
            }
            .frame(height: 6)
        }
    }
}
