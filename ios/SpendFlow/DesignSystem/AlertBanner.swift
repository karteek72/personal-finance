import SwiftUI

struct AlertBanner: View {
    let alert: Alert

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(alert.title)
                .font(.subheadline.weight(.semibold))
            Text(alert.message)
                .font(.caption)
                .foregroundStyle(SpendFlowColors.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(backgroundColor.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(backgroundColor.opacity(0.35), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(alert.title). \(alert.message)")
    }

    private var backgroundColor: Color {
        switch alert.severity {
        case .info: SpendFlowColors.primary
        case .warning: SpendFlowColors.warning
        case .danger: SpendFlowColors.danger
        }
    }
}
