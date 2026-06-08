import SwiftUI

/// Preset analytics window selector — mirrors web period control.
struct AnalyticsPeriodPicker: View {
    @Bindable var store: AnalyticsPeriodStore

    var body: some View {
        Menu {
            ForEach(AnalyticsPeriod.allCases, id: \.self) { preset in
                Button {
                    store.period = preset
                } label: {
                    if store.period == preset {
                        Label(preset.label, systemImage: "checkmark")
                    } else {
                        Text(preset.label)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.caption.weight(.semibold))
                Text(store.periodLabel)
                    .font(.caption.weight(.semibold))
                Image(systemName: "chevron.down")
                    .font(.caption2.weight(.bold))
            }
            .foregroundStyle(SpendFlowTheme.textMuted)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(SpendFlowTheme.surface.opacity(0.85), in: Capsule())
        }
        .accessibilityLabel("Analytics period")
        .accessibilityValue(store.periodLabel)
    }
}
