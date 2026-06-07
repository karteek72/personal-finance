import SwiftUI

@MainActor
@Observable
final class PatternsViewModel {
    var dayOfWeek: [PatternsResponse.DayOfWeek] = []
    var patterns: [PatternsResponse.PatternRow] = []
    var page = 1
    var totalPages = 1
    var query = ListQuery(page: 1, pageSize: 10, sort: "value", dir: .desc)
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.getPatterns(query: query)
            dayOfWeek = Self.sortedDays(response.dayOfWeek)
            patterns = response.patterns.rows
            page = response.patterns.page
            totalPages = response.patterns.totalPages
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func search(_ text: String) {
        query.q = text.isEmpty ? nil : text
        query.page = 1
    }

    func nextPage() {
        guard page < totalPages else { return }
        query.page = page + 1
    }

    func previousPage() {
        guard page > 1 else { return }
        query.page = page - 1
    }

    private static let dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    private static func sortedDays(_ days: [PatternsResponse.DayOfWeek]) -> [PatternsResponse.DayOfWeek] {
        days.sorted { lhs, rhs in
            (dayOrder.firstIndex(of: lhs.day) ?? 99) < (dayOrder.firstIndex(of: rhs.day) ?? 99)
        }
    }
}

struct PatternsView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = PatternsViewModel()

    var body: some View {
        SpendFlowScreen(title: "Patterns", subtitle: "When and how you spend") {
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
        if viewModel.isLoading, viewModel.dayOfWeek.isEmpty, viewModel.patterns.isEmpty {
            LoadingStateView(message: "Finding patterns…")
        } else if let error = viewModel.errorMessage, viewModel.dayOfWeek.isEmpty, viewModel.patterns.isEmpty {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else {
            dayOfWeekChart
            patternsList
        }
    }

    private var dayOfWeekChart: some View {
        let weekdayTotal = viewModel.dayOfWeek
            .filter { $0.day != "Sat" && $0.day != "Sun" }
            .reduce(0.0) { $0 + AnalyticsUI.parseAmount($1.value) }
        let weekendTotal = viewModel.dayOfWeek
            .filter { $0.day == "Sat" || $0.day == "Sun" }
            .reduce(0.0) { $0 + AnalyticsUI.parseAmount($1.value) }
        let weekdayAvg = weekdayTotal / 5
        let weekendAvg = weekendTotal / 2
        let weekendLift = weekdayAvg > 0 ? Int(((weekendAvg - weekdayAvg) / weekdayAvg) * 100) : 0

        return VStack(alignment: .leading, spacing: 12) {
            SpendFlowChartView(
                title: "Average spend by day of week",
                points: viewModel.dayOfWeek.map {
                    ChartDataPoint(id: $0.day, label: $0.day, value: AnalyticsUI.parseAmount($0.value))
                },
                style: .bar,
                yAxisLabel: "Spend",
                valueFormatter: { MoneyFormatter.format(String(format: "%.2f", $0)) }
            )

            if weekdayAvg + weekendAvg > 0 {
                Text("Weekends average \(MoneyFormatter.format(String(format: "%.0f", weekendAvg)))/day vs \(MoneyFormatter.format(String(format: "%.0f", weekdayAvg)))/day on weekdays\(weekendLift != 0 ? " (\(weekendLift > 0 ? "+" : "")\(weekendLift)% vs weekdays)." : ".")")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.primary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SpendFlowTheme.primarySoft.opacity(0.5), in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
            }
        }
    }

    private var patternsList: some View {
        PaginatedListView(
            title: "Spending patterns detected",
            query: Binding(
                get: { viewModel.query },
                set: { viewModel.query = $0 }
            ),
            rows: viewModel.patterns,
            page: viewModel.page,
            totalPages: viewModel.totalPages,
            isLoading: viewModel.isLoading,
            errorMessage: viewModel.errorMessage,
            onReload: { Task { await viewModel.load(api: appState.apiClient) } },
            onNextPage: {
                viewModel.nextPage()
                Task { await viewModel.load(api: appState.apiClient) }
            },
            onPreviousPage: {
                viewModel.previousPage()
                Task { await viewModel.load(api: appState.apiClient) }
            },
            onSearch: { text in
                viewModel.search(text)
                Task { await viewModel.load(api: appState.apiClient) }
            }
        ) { pattern in
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 10) {
                    Text(pattern.value)
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            pattern.severity == "warning"
                                ? SpendFlowTheme.warning.opacity(0.15)
                                : SpendFlowTheme.border.opacity(0.5),
                            in: Capsule()
                        )
                        .foregroundStyle(
                            pattern.severity == "warning" ? SpendFlowTheme.warning : SpendFlowTheme.textMuted
                        )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(pattern.label)
                            .font(.subheadline.weight(.semibold))
                        Text(pattern.description)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }
}
