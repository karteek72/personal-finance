import SwiftUI

/// Rolling 12-month vs single-month picker for the home dashboard.
struct DashboardPeriodControls: View {
    @Binding var mode: DashboardPeriodMode
    @Binding var selectedMonth: String

    private var monthOptions: [FilterMenuOption] {
        DashboardDateRange.recentMonthKeys().map {
            FilterMenuOption(id: $0, label: DashboardDateRange.monthLabel($0))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PERIOD")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
                .tracking(0.6)

            HStack(spacing: 8) {
                ForEach(DashboardPeriodMode.allCases, id: \.self) { option in
                    Button {
                        mode = option
                    } label: {
                        Text(option.label)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background {
                                Capsule()
                                    .fill(mode == option ? SpendFlowTheme.primary : SpendFlowTheme.surface)
                            }
                            .overlay {
                                Capsule()
                                    .stroke(mode == option ? Color.clear : SpendFlowTheme.border, lineWidth: 1)
                            }
                            .foregroundStyle(mode == option ? .white : SpendFlowTheme.textMuted)
                    }
                    .buttonStyle(.plain)
                }

                if mode == .month {
                    FilterMenuField(
                        title: "Month",
                        selection: DashboardDateRange.monthLabel(selectedMonth),
                        options: monthOptions
                    ) { option in
                        selectedMonth = option.id
                    }
                    .frame(maxWidth: 180)
                }
            }

            Text(DashboardDateRange.periodLabel(mode: mode, monthKey: selectedMonth))
                .font(.caption)
                .foregroundStyle(SpendFlowTheme.textMuted)
        }
    }
}
