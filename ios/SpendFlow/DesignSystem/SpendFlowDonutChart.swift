import Charts
import SwiftUI

struct DonutSlice: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let value: Double
    let percentage: Double
    let color: Color
}

/// Sector-mark donut with tap selection and legend.
struct SpendFlowDonutChart: View {
    let title: String?
    var subtitle: String?
    let slices: [DonutSlice]
    var selectedID: String?
    var onSelect: ((String) -> Void)?

    @State private var highlightedID: String?

    private var activeID: String? {
        highlightedID ?? selectedID
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(SpendFlowTheme.text)
                    if let subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                }
            }

            if slices.isEmpty {
                Text("No data for this period")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .frame(maxWidth: .infinity, minHeight: 160)
            } else {
                HStack(alignment: .center, spacing: 16) {
                    Chart(slices) { slice in
                        SectorMark(
                            angle: .value("Amount", slice.value),
                            innerRadius: .ratio(0.58),
                            angularInset: 1.5
                        )
                        .foregroundStyle(slice.color)
                        .opacity(activeID == nil || activeID == slice.id ? 1 : 0.35)
                    }
                    .chartLegend(.hidden)
                    .frame(width: 140, height: 140)

                    Group {
                        if slices.count > 6 {
                            ScrollView(showsIndicators: false) {
                                legendRows
                            }
                            .frame(maxHeight: 180)
                        } else {
                            legendRows
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(16)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.5), lineWidth: 1)
        )
        .onChange(of: selectedID) { _, newValue in
            highlightedID = newValue
        }
    }

    private var legendRows: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(slices) { slice in
                Button {
                    guard let onSelect else { return }
                    if activeID == slice.id {
                        highlightedID = nil
                        onSelect("")
                    } else {
                        highlightedID = slice.id
                        onSelect(slice.id)
                    }
                } label: {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(slice.color)
                            .frame(width: 8, height: 8)
                        Text(slice.name)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.text)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Text(String(format: "%.0f%%", slice.percentage))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                }
                .buttonStyle(.plain)
                .opacity(activeID == nil || activeID == slice.id ? 1 : 0.45)
            }
        }
    }
}

extension DonutSlice {
    static func fromCategory(_ slice: ChartCategorySlice) -> DonutSlice {
        DonutSlice(
            id: slice.name,
            name: slice.name,
            value: AnalyticsUI.parseAmount(slice.amount),
            percentage: slice.percentage,
            color: CategoryColor.forCategory(slice.name)
        )
    }

    static func fromMember(_ slice: ChartMemberSlice) -> DonutSlice {
        DonutSlice(
            id: slice.id,
            name: slice.name,
            value: AnalyticsUI.parseAmount(slice.amount),
            percentage: slice.percentage,
            color: Color(hex: slice.color)
        )
    }

    static func fromSector(_ slice: PortfolioSectorAllocation) -> DonutSlice {
        DonutSlice(
            id: slice.sector,
            name: slice.sector,
            value: AnalyticsUI.parseAmount(slice.value),
            percentage: slice.sharePercent,
            color: ChartPalette.color(forLabel: slice.sector, index: ChartPalette.stableIndex(for: slice.sector))
        )
    }
}
