import SwiftUI

struct FilterMenuOption: Identifiable, Hashable {
    let id: String
    let label: String
}

/// Dropdown filter control — mirrors web `FilterSelect`.
struct FilterMenuField: View {
    let title: String
    let selection: String
    let options: [FilterMenuOption]
    let onSelect: (FilterMenuOption) -> Void

    var body: some View {
        Menu {
            ForEach(options) { option in
                Button(option.label) { onSelect(option) }
            }
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                HStack {
                    Text(selection)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.text)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
            .overlay(
                RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM)
                    .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
            )
        }
    }
}
