import SwiftUI

/// Surfaces confidence and caveats from analytics metric envelopes.
struct MetricEnvelopeView: View {
    let metric: MetricEnvelope
    var valueFormatter: (String) -> String = { $0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(valueFormatter(metric.value))
                    .font(.title2.bold().monospacedDigit())
                Spacer()
                Text("\(Int(metric.confidence * 100))% conf.")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }

            Text("\(metric.class.rawValue) · \(metric.basis.rawValue) · \(metric.grain)")
                .font(.caption2)
                .foregroundStyle(SpendFlowTheme.textMuted)

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
