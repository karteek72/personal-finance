import Charts
import SwiftUI

struct ChartDataPoint: Identifiable, Equatable, Sendable {
    let id: String
    let label: String
    let value: Double
}

/// Bar or line chart with labeled axes and tap-to-inspect selection.
struct SpendFlowChartView: View {
    let title: String?
    let points: [ChartDataPoint]
    var style: Style = .bar
    var yAxisLabel: String = "Value"
    var valueFormatter: (Double) -> String = { String(format: "%.0f", $0) }

    enum Style {
        case bar
        case line
    }

    @State private var selected: ChartDataPoint?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(SpendFlowTheme.text)
            }

            if let selected {
                HStack {
                    Text(selected.label)
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(valueFormatter(selected.value))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(SpendFlowTheme.primary)
                }
                .padding(.horizontal, 4)
            }

            Chart(points) { point in
                if style == .bar {
                    BarMark(
                        x: .value("Category", point.label),
                        y: .value(yAxisLabel, point.value)
                    )
                    .foregroundStyle(
                        selected?.id == point.id
                            ? SpendFlowTheme.primary
                            : SpendFlowTheme.primary.opacity(0.65)
                    )
                    .annotation(position: .top, alignment: .center) {
                        if points.count <= 8 {
                            Text(valueFormatter(point.value))
                                .font(.caption2)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                        }
                    }
                } else {
                    LineMark(
                        x: .value("Category", point.label),
                        y: .value(yAxisLabel, point.value)
                    )
                    .foregroundStyle(SpendFlowTheme.primary)
                    PointMark(
                        x: .value("Category", point.label),
                        y: .value(yAxisLabel, point.value)
                    )
                    .foregroundStyle(SpendFlowTheme.primary)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        if let doubleValue = value.as(Double.self) {
                            Text(valueFormatter(doubleValue))
                                .font(.caption2)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel {
                        if let label = value.as(String.self) {
                            Text(label)
                                .font(.caption2)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .chartOverlay { proxy in
                GeometryReader { geometry in
                    Rectangle()
                        .fill(Color.clear)
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { gesture in
                                    let origin = geometry[proxy.plotFrame!].origin
                                    let location = CGPoint(
                                        x: gesture.location.x - origin.x,
                                        y: gesture.location.y - origin.y
                                    )
                                    if let label: String = proxy.value(atX: location.x) {
                                        selected = points.first { $0.label == label }
                                    }
                                }
                                .onEnded { _ in
                                    selected = nil
                                }
                        )
                }
            }
            .frame(height: 220)
        }
        .padding(16)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.5), lineWidth: 1)
        )
    }
}

/// Multi-line category trend chart with labeled axes.
struct SpendFlowTrendChart: View {
    let title: String
    var subtitle: String?
    let trends: [CategoryTrend]
    var highlightedCategory: String?
    var onSelectCategory: ((String) -> Void)?

    private struct TrendPoint: Identifiable {
        let id: String
        let month: String
        let category: String
        let value: Double
    }

    private var points: [TrendPoint] {
        trends.flatMap { trend in
            trend.months.map { month in
                TrendPoint(
                    id: "\(trend.name)-\(month.month)",
                    month: AnalyticsUI.shortMonth(month.month),
                    category: trend.name,
                    value: AnalyticsUI.parseAmount(month.amount)
                )
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(SpendFlowTheme.text)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
            }

            if points.isEmpty {
                Text("No trend data yet")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else {
                Chart(points) { point in
                    LineMark(
                        x: .value("Month", point.month),
                        y: .value("Amount", point.value)
                    )
                    .foregroundStyle(by: .value("Category", point.category))
                    .opacity(
                        highlightedCategory == nil || highlightedCategory == point.category ? 1 : 0.2
                    )
                }
                .chartForegroundStyleScale { category in
                    CategoryColor.forCategory(category)
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisValueLabel {
                            if let doubleValue = value.as(Double.self) {
                                Text(compactCurrency(doubleValue))
                                    .font(.caption2)
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel {
                            if let label = value.as(String.self) {
                                Text(label)
                                    .font(.caption2)
                            }
                        }
                    }
                }
                .frame(height: 220)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(trends) { trend in
                            Button {
                                onSelectCategory?(highlightedCategory == trend.name ? "" : trend.name)
                            } label: {
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(CategoryColor.forCategory(trend.name))
                                        .frame(width: 8, height: 8)
                                    Text(trend.name)
                                        .font(.caption2.weight(.semibold))
                                        .lineLimit(1)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background {
                                    Capsule()
                                        .fill(
                                            highlightedCategory == trend.name
                                                ? SpendFlowTheme.primarySoft
                                                : SpendFlowTheme.surface
                                        )
                                }
                                .overlay {
                                    Capsule()
                                        .stroke(SpendFlowTheme.border, lineWidth: 1)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.5), lineWidth: 1)
        )
    }

    private func compactCurrency(_ value: Double) -> String {
        if value >= 1_000 {
            return String(format: "$%.0fk", value / 1_000)
        }
        return String(format: "$%.0f", value)
    }
}
