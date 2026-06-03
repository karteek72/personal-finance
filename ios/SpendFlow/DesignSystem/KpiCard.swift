import SwiftUI

struct KpiCard: View {
    let label: String
    let value: String
    var subtext: String?
    var emoji: String?
    var tone: Tone = .neutral

    enum Tone {
        case neutral
        case primary
        case success
        case danger
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                if let emoji { Text(emoji).font(.caption) }
                Text(label.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .tracking(0.5)
            }

            MoneyText(amount: value, font: .title3.weight(.bold).monospacedDigit())

            if let subtext {
                Text(subtext)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .fill(SpendFlowTheme.surface)
        }
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(accentColor)
                .frame(width: 4)
                .padding(.vertical, 12)
        }
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                .stroke(SpendFlowTheme.border.opacity(0.8), lineWidth: 1)
        )
        .shadow(color: SpendFlowTheme.primary.opacity(0.05), radius: 10, x: 0, y: 4)
    }

    private var accentColor: Color {
        switch tone {
        case .neutral: SpendFlowTheme.border
        case .primary: SpendFlowTheme.primary
        case .success: SpendFlowTheme.success
        case .danger: SpendFlowTheme.danger
        }
    }
}
