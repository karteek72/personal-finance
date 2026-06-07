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
