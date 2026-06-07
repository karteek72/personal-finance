import SwiftUI

@MainActor
@Observable
final class InflationViewModel {
    var data: InflationResponse?
    var categories: [InflationResponse.CategoryRow] = []
    var page = 1
    var totalPages = 1
    var query = ListQuery(page: 1, pageSize: 9, sort: "inflation", dir: .desc)
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await api.getInflation(query: query)
            data = response
            categories = response.categories.rows
            page = response.categories.page
            totalPages = response.categories.totalPages
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
}

struct InflationView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = InflationViewModel()

    var body: some View {
        SpendFlowScreen(title: "Inflation", subtitle: "Your personal CPI") {
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
            LoadingStateView(message: "Calculating personal inflation…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            heroSection(data)
            negotiationBrief(data)
            categoriesList
        }
    }

    private func heroSection(_ data: InflationResponse) -> some View {
        let comparison: String = {
            if data.personalRate > data.nationalCpi {
                "your lifestyle inflates faster than the national average"
            } else if data.personalRate < data.nationalCpi {
                "your lifestyle inflates slower than the national average"
            } else {
                "your lifestyle tracks the national average"
            }
        }()

        return VStack(spacing: 12) {
            HeroGradientCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your personal inflation rate")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.8))
                    Text(String(format: "%.1f%%", data.personalRate))
                        .font(.system(size: 44, weight: .heavy, design: .rounded).monospacedDigit())
                        .foregroundStyle(.white)
                    Text("vs. national CPI \(String(format: "%.1f", data.nationalCpi))% — \(comparison)")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                }
            }

            HStack(spacing: 12) {
                metricCard(
                    title: "Your raise this year",
                    value: String(format: "%.1f%%", data.salaryRaise),
                    subtitle: "Real raise: \(data.realRaise >= 0 ? "+" : "")\(String(format: "%.1f", data.realRaise))%",
                    subtitleColor: data.realRaise < 0 ? SpendFlowTheme.danger : SpendFlowTheme.success
                )
                metricCard(
                    title: "Real savings rate",
                    value: String(format: "%.1f%%", data.realSavingsRate),
                    subtitle: "after \(String(format: "%.1f", data.personalRate))% inflation"
                )
            }

            HStack(spacing: 12) {
                metricCard(
                    title: "Purchasing power loss",
                    value: MoneyFormatter.format(data.powerLoss),
                    subtitle: "on a \(MoneyFormatter.format(data.salary)) salary",
                    valueColor: SpendFlowTheme.danger
                )
                metricCard(
                    title: "Raise needed to break even",
                    value: MoneyFormatter.format(
                        String(format: "%.2f", AnalyticsUI.parseAmount(data.breakEvenSalary) - AnalyticsUI.parseAmount(data.salary))
                    ),
                    subtitle: "at your personal inflation rate"
                )
            }
        }
    }

    private func metricCard(
        title: String,
        value: String,
        subtitle: String,
        valueColor: Color = SpendFlowTheme.text,
        subtitleColor: Color = SpendFlowTheme.textMuted
    ) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Text(value)
                    .font(.title3.weight(.heavy).monospacedDigit())
                    .foregroundStyle(valueColor)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(subtitleColor)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func negotiationBrief(_ data: InflationResponse) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 8) {
                Label("Salary Negotiation Brief", systemImage: "dollarsign.circle.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.primary)
                Text("Your personal inflation rate this year: \(String(format: "%.1f", data.personalRate))%")
                Text("Your raise: \(String(format: "%.1f", data.salaryRaise))% — that is a \(data.realRaise >= 0 ? "+" : "")\(String(format: "%.1f", data.realRaise))% real \(data.realRaise < 0 ? "pay cut" : "raise")")
                Text("To maintain purchasing power at \(MoneyFormatter.format(data.salary)), you need: \(MoneyFormatter.format(data.breakEvenSalary))")
                Text("To actually advance financially: \(MoneyFormatter.format(data.targetSalary))+")
            }
            .font(.caption)
            .foregroundStyle(SpendFlowTheme.text)
        }
    }

    private var categoriesList: some View {
        PaginatedListView(
            title: "Category inflation",
            query: Binding(
                get: { viewModel.query },
                set: { viewModel.query = $0 }
            ),
            rows: viewModel.categories,
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
        ) { category in
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(category.name)
                        .font(.subheadline.weight(.semibold))
                    Text("\(String(format: "%.1f", category.share))% of budget")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(String(format: "%.1f", category.inflation))%")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(AnalyticsUI.severityColor(category.severity))
                    Text(category.severity.capitalized)
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(AnalyticsUI.severityColor(category.severity).opacity(0.15), in: Capsule())
                        .foregroundStyle(AnalyticsUI.severityColor(category.severity))
                }
            }
            .padding(.vertical, 4)
        }
    }
}
