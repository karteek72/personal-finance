import SwiftUI

/// Live vs cached indicator for analytics metrics.
struct MetricLiveBadge: View {
    let isLive: Bool

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(isLive ? SpendFlowTheme.success : SpendFlowTheme.textMuted)
                .frame(width: 6, height: 6)
            Text(isLive ? "Live" : "Cached")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(SpendFlowTheme.textMuted)
        }
    }
}

/// Surfaces confidence and caveats from analytics metric envelopes.
struct MetricEnvelopeView: View {
    let metric: MetricEnvelope
    var isLive: Bool?
    var valueFormatter: (String) -> String = { $0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(valueFormatter(metric.value))
                    .font(.title2.bold().monospacedDigit())
                Spacer()
                if let isLive {
                    MetricLiveBadge(isLive: isLive)
                }
                Text("\(Int(metric.confidence * 100))% conf.")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }

            Text("\(metric.class.rawValue) · \(metric.basis.rawValue) · \(metric.grain)")
                .font(.caption2)
                .foregroundStyle(SpendFlowTheme.textMuted)

            if !metric.asOf.isEmpty {
                Text("As of \(metric.asOf)")
                    .font(.caption2)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }

            if let trend = metric.trend {
                HStack(spacing: 4) {
                    Image(systemName: trendIcon(trend.direction))
                    Text("\(trend.delta) (\(trend.comparison))")
                }
                .font(.caption)
                .foregroundStyle(trendColor(trend.direction))
            }

            if let caveats = metric.caveats, !caveats.isEmpty {
                ForEach(caveats, id: \.self) { caveat in
                    Label(caveat, systemImage: "info.circle")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.warning)
                }
            }
        }
    }

    private func trendIcon(_ direction: TrendDirection) -> String {
        switch direction {
        case .up: "arrow.up.right"
        case .down: "arrow.down.right"
        case .flat: "arrow.right"
        }
    }

    private func trendColor(_ direction: TrendDirection) -> Color {
        switch direction {
        case .up: SpendFlowTheme.success
        case .down: SpendFlowTheme.danger
        case .flat: SpendFlowTheme.textMuted
        }
    }
}

enum MetricEnvelopeFactory {
    static func wellnessScore(_ data: WellnessResponse) -> MetricEnvelope {
        let caveats = data.dimensions.compactMap(\.caveats).flatMap { $0 }
        return MetricEnvelope(
            value: String(format: "%.0f", data.score),
            unit: .score,
            grain: "monthly",
            asOf: currentMonthLabel(),
            class: .diagnostic,
            basis: .factual,
            confidence: data.confidence ?? 0.5,
            trend: MetricTrend(
                delta: String(format: "%+.0f pts", data.delta),
                deltaPct: 0,
                direction: data.delta >= 0 ? .up : data.delta < 0 ? .down : .flat,
                comparison: "vs last month"
            ),
            caveats: caveats.isEmpty ? nil : Array(Set(caveats))
        )
    }

    static func immunityScore(_ data: ResilienceResponse) -> MetricEnvelope {
        MetricEnvelope(
            value: String(format: "%.0f", data.immunityScore),
            unit: .score,
            grain: "current",
            asOf: currentMonthLabel(),
            class: .diagnostic,
            basis: .heuristic,
            confidence: data.confidence ?? 0.65,
            trend: nil,
            caveats: data.caveats ?? ["Based on liquid cash and estimated monthly burn."]
        )
    }

    private static func currentMonthLabel() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: Date())
    }
}
