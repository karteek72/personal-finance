import SwiftUI

struct AlertBanner: View {
    let alert: Alert

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(severityEmoji)
                .font(.title3)
            VStack(alignment: .leading, spacing: 4) {
                Text(alert.title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.text)
                Text(alert.message)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .fill(backgroundColor.opacity(0.12))
        }
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .stroke(backgroundColor.opacity(0.3), lineWidth: 1)
        )
    }

    private var severityEmoji: String {
        switch alert.severity {
        case .info: "💡"
        case .warning: "⚡️"
        case .danger: "🚨"
        }
    }

    private var backgroundColor: Color {
        switch alert.severity {
        case .info: SpendFlowTheme.primary
        case .warning: SpendFlowTheme.warning
        case .danger: SpendFlowTheme.danger
        }
    }
}
