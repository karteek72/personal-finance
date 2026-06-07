import SwiftUI

@MainActor
@Observable
final class DebtViewModel {
    var data: CreditDebtSummary?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getCreditDebtSummary()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct DebtView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DebtViewModel()

    var body: some View {
        SpendFlowScreen(title: "Credit & Debt", subtitle: "Balances, APRs, and payments") {
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
            LoadingStateView(message: "Loading debt summary…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            summaryCards(data: data)
            if data.overdueCount > 0 {
                overdueBanner(count: data.overdueCount)
            }
            Text(data.coverageLabel)
                .font(.caption)
                .foregroundStyle(SpendFlowTheme.textMuted)
            if data.cards.isEmpty {
                emptyState
            } else {
                ForEach(data.cards) { card in
                    cardDetail(card)
                }
            }
        }
    }

    private func summaryCards(data: CreditDebtSummary) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                KpiCard(
                    label: "Credit balance",
                    value: data.totalCurrentBalance,
                    emoji: "💳",
                    tone: .danger
                )
                KpiCard(
                    label: "Statement total",
                    value: data.totalStatementBalance,
                    emoji: "📄",
                    tone: .neutral
                )
            }
            HStack(spacing: 12) {
                KpiCard(
                    label: "Minimum due",
                    value: data.totalMinimumDue,
                    emoji: "⚠️",
                    tone: .neutral
                )
                KpiCard(
                    label: "Est. monthly interest",
                    value: data.totalEstimatedMonthlyInterest,
                    emoji: "📈",
                    tone: .neutral
                )
            }
        }
    }

    private func overdueBanner(count: Int) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
            Text("\(count) card\(count == 1 ? "" : "s") overdue")
                .font(.subheadline.weight(.semibold))
        }
        .foregroundStyle(SpendFlowTheme.danger)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SpendFlowTheme.danger.opacity(0.1), in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
    }

    private var emptyState: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("No credit cards connected")
                    .font(.subheadline.weight(.bold))
                Text("Link a credit card to see balances, APRs, and payment due dates.")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
        }
    }

    private func cardDetail(_ card: CreditCardDebtRow) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(card.name)
                            .font(.headline.weight(.bold))
                        Text(card.institutionName)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                        if let mask = card.mask {
                            Text("•••• \(mask)")
                                .font(.caption2)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                        }
                    }
                    Spacer()
                    MoneyText(amount: card.balanceCurrent, font: .title3.weight(.bold))
                }

                if let liability = card.liability {
                    liabilityDetails(liability)
                }
            }
        }
    }

    @ViewBuilder
    private func liabilityDetails(_ liability: AccountCreditLiability) -> some View {
        Divider().opacity(0.5)

        if liability.isOverdue == true {
            Label("Overdue", systemImage: "exclamationmark.circle.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.danger)
        }

        detailGrid(liability)

        if let purchaseApr = liability.purchaseApr {
            HStack {
                Text("Purchase APR")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Spacer()
                Text(purchaseApr)
                    .font(.caption.weight(.bold))
            }
        }

        if let estimatedInterest = liability.estimatedMonthlyInterest {
            HStack {
                Text("Est. monthly interest")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Spacer()
                MoneyText(amount: estimatedInterest, font: .caption.weight(.bold))
            }
        }

        if !liability.aprs.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("APR breakdown")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                ForEach(Array(liability.aprs.enumerated()), id: \.offset) { _, apr in
                    HStack {
                        Text(apr.aprType.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.caption2)
                        Spacer()
                        Text(apr.aprPercentage)
                            .font(.caption2.weight(.semibold))
                    }
                }
            }
        }
    }

    private func detailGrid(_ liability: AccountCreditLiability) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            if let statement = liability.lastStatementBalance {
                detailCell(label: "Statement", value: statement)
            }
            if let minimum = liability.minimumPaymentAmount {
                detailCell(label: "Minimum due", value: minimum)
            }
            if let dueDate = liability.nextPaymentDueDate {
                detailCell(label: "Due date", value: dueDate)
            }
            if let days = liability.daysUntilDue {
                detailCell(label: "Days until due", value: "\(days)")
            }
            if let lastPayment = liability.lastPaymentAmount {
                detailCell(label: "Last payment", value: lastPayment)
            }
            if let lastPaymentDate = liability.lastPaymentDate {
                detailCell(label: "Paid on", value: lastPaymentDate)
            }
        }
    }

    private func detailCell(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(SpendFlowTheme.textMuted)
            if label.contains("due") || label == "Paid on" || label == "Due date" {
                Text(value)
                    .font(.caption.weight(.semibold))
            } else {
                MoneyText(amount: value, font: .caption.weight(.semibold))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(SpendFlowTheme.primarySoft.opacity(0.35), in: RoundedRectangle(cornerRadius: 8))
    }
}
