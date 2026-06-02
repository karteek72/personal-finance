import SwiftUI

struct KpiCard: View {
    let label: String
    let value: String
    var subtext: String?
    var tone: Tone = .neutral

    enum Tone {
        case neutral
        case primary
        case success
        case danger
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(SpendFlowColors.textMuted)

            MoneyText(amount: value, font: .headline.monospacedDigit())

            if let subtext {
                Text(subtext)
                    .font(.caption)
                    .foregroundStyle(SpendFlowColors.textMuted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(SpendFlowColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(SpendFlowColors.border, lineWidth: 1)
        )
        .overlay(alignment: .leading) {
            if tone != .neutral {
                RoundedRectangle(cornerRadius: 2)
                    .fill(accentColor)
                    .frame(width: 3)
                    .padding(.vertical, 8)
            }
        }
    }

    private var accentColor: Color {
        switch tone {
        case .neutral: SpendFlowColors.border
        case .primary: SpendFlowColors.primary
        case .success: SpendFlowColors.success
        case .danger: SpendFlowColors.danger
        }
    }
}
