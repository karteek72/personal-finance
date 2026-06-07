import SwiftUI

@MainActor
@Observable
final class CalendarViewModel {
    var data: CalendarResponse?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getCalendar()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct CalendarView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CalendarViewModel()

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        SpendFlowScreen(title: "Calendar", subtitle: "Cashflow events and spending heat") {
            content
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading, viewModel.data == nil {
            LoadingStateView(message: "Building calendar…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            monthHeader(data: data)
            totalsRow(data: data)
            heatGrid(data: data)
            eventsList(data: data)
        }
    }

    private func monthHeader(data: CalendarResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(data.month)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.85))
            Text("Safe to spend today")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.9))
            MoneyText(
                amount: data.safeToSpendToday,
                font: .system(size: 34, weight: .heavy).monospacedDigit()
            )
            .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(22)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(SpendFlowTheme.heroGradient)
        }
    }

    private func totalsRow(data: CalendarResponse) -> some View {
        HStack(spacing: 12) {
            KpiCard(label: "Income", value: data.totals.income, emoji: "💰", tone: .success)
            KpiCard(label: "Bills", value: data.totals.bills, emoji: "📋", tone: .danger)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func heatGrid(data: CalendarResponse) -> some View {
        let heatByDay = Dictionary(uniqueKeysWithValues: data.heat.map { ($0.day, $0.level) })
        let daysInMonth = daysInMonth(for: data.month)

        return GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Spending heat")
                    .font(.headline.weight(.bold))

                LazyVGrid(columns: columns, spacing: 4) {
                    ForEach(1...daysInMonth, id: \.self) { day in
                        let level = heatByDay[day] ?? 0
                        Text("\(day)")
                            .font(.caption2.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(heatColor(level).opacity(heatOpacity(level)))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
        }
    }

    private func eventsList(data: CalendarResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Events")
                .font(.headline.weight(.bold))

            if data.events.isEmpty {
                Text("No events this month")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            } else {
                ForEach(data.events.sorted(by: { $0.day < $1.day })) { event in
                    HStack(spacing: 12) {
                        Text("Day \(event.day)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(SpendFlowTheme.primary)
                            .frame(width: 52, alignment: .leading)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.label)
                                .font(.subheadline.weight(.semibold))
                            Text(event.type.capitalized)
                                .font(.caption2)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                        }
                        Spacer()
                        MoneyText(amount: event.amount, font: .caption.weight(.bold))
                    }
                    .padding(12)
                    .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
                    .overlay(
                        RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM)
                            .stroke(SpendFlowTheme.border.opacity(0.6), lineWidth: 1)
                    )
                }
            }
        }
    }

    private func daysInMonth(for month: String) -> Int {
        let parts = month.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let monthNum = Int(parts[1]) else { return 31 }
        var components = DateComponents()
        components.year = year
        components.month = monthNum + 1
        components.day = 0
        let calendar = Calendar.current
        guard let date = calendar.date(from: components) else { return 31 }
        return calendar.component(.day, from: date)
    }

    private func heatColor(_ level: Int) -> Color {
        switch level {
        case 0: SpendFlowTheme.border
        case 1...2: SpendFlowTheme.success
        case 3...4: SpendFlowTheme.warning
        default: SpendFlowTheme.danger
        }
    }

    private func heatOpacity(_ level: Int) -> Double {
        level == 0 ? 0.25 : 0.15 + Double(min(level, 5)) * 0.14
    }
}
