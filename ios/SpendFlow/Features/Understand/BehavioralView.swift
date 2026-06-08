import SwiftUI

private struct SpendReason: Identifiable, Sendable {
    let id: String
    let emoji: String
    let label: String
    let color: Color
}

private let defaultReasons: [SpendReason] = [
    .init(id: "need", emoji: "✅", label: "Needed it", color: SpendFlowTheme.success),
    .init(id: "treat", emoji: "🎉", label: "Treat", color: Color(hex: "#A855F7")),
    .init(id: "social", emoji: "👥", label: "Social", color: Color(hex: "#3B82F6")),
    .init(id: "bored", emoji: "😐", label: "Bored", color: SpendFlowTheme.warning),
    .init(id: "stress", emoji: "😣", label: "Stress", color: SpendFlowTheme.danger),
    .init(id: "impulse", emoji: "⚡", label: "Impulse", color: SpendFlowTheme.accent),
]

@MainActor
@Observable
final class BehavioralViewModel {
    var data: BehavioralResponse?
    var localTags: [String: String] = [:]
    var pendingTransactionId: String?
    var isLoading = false
    var errorMessage: String?

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getBehavioral()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func activeReason(for transaction: BehavioralResponse.TaggedTransaction) -> String? {
        localTags[transaction.id] ?? (transaction.reasonId.isEmpty ? nil : transaction.reasonId)
    }

    func toggleReason(for transaction: BehavioralResponse.TaggedTransaction, reasonId: String, api: APIClient) async {
        pendingTransactionId = transaction.id
        defer { pendingTransactionId = nil }

        let current = activeReason(for: transaction)
        let clearing = current == reasonId

        do {
            if clearing {
                _ = try await api.clearTransactionReason(transactionId: transaction.id)
                localTags.removeValue(forKey: transaction.id)
            } else {
                _ = try await api.setTransactionReason(transactionId: transaction.id, reasonId: reasonId)
                localTags[transaction.id] = reasonId
            }
            await load(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var reasonTotals: [String: Double] {
        guard let reasons = data?.reasons else { return [:] }
        return Dictionary(uniqueKeysWithValues: reasons.map { ($0.id, AnalyticsUI.parseAmount($0.total)) })
    }

    var emotionalPercent: Int {
        let totals = reasonTotals
        let emotional = (totals["stress"] ?? 0) + (totals["bored"] ?? 0) + (totals["impulse"] ?? 0)
        let total = totals.values.reduce(0, +)
        guard total > 0 else { return 0 }
        return Int((emotional / total) * 100)
    }
}

struct BehavioralView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = BehavioralViewModel()

    var body: some View {
        SpendFlowScreen(title: "Behavioral", subtitle: "Streaks, reasons & challenges") {
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
            LoadingStateView(message: "Loading behavioral insights…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            archetypeHero(data)
            lifestyleCreep(data)
            emotionalHero
            tagInbox(data)
            reasonsBreakdown
            streaksSection(data.streaks)
            challengesSection(data.challenges)
        }
    }

    private func archetypeHero(_ data: BehavioralResponse) -> some View {
        let topReasons = defaultReasons
            .map { ($0, viewModel.reasonTotals[$0.id] ?? 0) }
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
            .prefix(3)

        return HeroGradientCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Your spending archetype")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.7))
                    .textCase(.uppercase)
                Text(data.archetype)
                    .font(.title.weight(.heavy))
                    .foregroundStyle(.white)
                if topReasons.isEmpty {
                    Text("Tag transactions with reasons to refine your spending personality.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                } else {
                    HStack {
                        ForEach(Array(topReasons.enumerated()), id: \.offset) { _, item in
                            Text(item.0.label)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(.white.opacity(0.2), in: Capsule())
                                .foregroundStyle(.white)
                        }
                    }
                }
            }
        }
    }

    private func lifestyleCreep(_ data: BehavioralResponse) -> some View {
        let spending = data.creep.spending.map { AnalyticsUI.parseAmount($0) }
        let hasCreep = !data.creep.months.isEmpty

        return SpendFlowCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Lifestyle creep detector")
                            .font(.subheadline.weight(.semibold))
                        Text("Income vs. spending over time")
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                    Spacer()
                    if hasCreep {
                        Text("Creep detected")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(SpendFlowTheme.warning.opacity(0.15), in: Capsule())
                            .foregroundStyle(SpendFlowTheme.warning)
                    }
                }

                if !hasCreep {
                    Text("Need more months of income and spending history.")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                } else {
                    let points = data.creep.months.enumerated().map { index, month in
                        ChartDataPoint(
                            id: month,
                            label: AnalyticsUI.shortMonth(month),
                            value: spending[index]
                        )
                    }
                    SpendFlowChartView(
                        title: nil,
                        points: points,
                        style: .bar,
                        valueFormatter: { MoneyFormatter.format(String(format: "%.0f", $0)) }
                    )
                }
            }
        }
    }

    private var emotionalHero: some View {
        let totals = viewModel.reasonTotals
        let emotional = (totals["stress"] ?? 0) + (totals["bored"] ?? 0) + (totals["impulse"] ?? 0)
        let total = totals.values.reduce(0, +)

        return HeroGradientCard {
            VStack(alignment: .leading, spacing: 6) {
                Text("Emotional spending this month")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.7))
                    .textCase(.uppercase)
                Text("\(viewModel.emotionalPercent)%")
                    .font(.system(size: 44, weight: .heavy, design: .rounded).monospacedDigit())
                    .foregroundStyle(.white)
                if total > 0 {
                    Text("\(MoneyFormatter.format(String(format: "%.2f", emotional))) of your \(MoneyFormatter.format(String(format: "%.2f", total))) discretionary spend was tagged stress, bored, or impulse.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                } else {
                    Text("Tag recent purchases to see how much of your spend is emotional.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
        }
    }

    private func tagInbox(_ data: BehavioralResponse) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Why did you buy these?")
                    .font(.headline)
                Text("Tap a reason — patterns build over time.")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)

                if data.taggedTransactions.isEmpty {
                    FeatureEmptyCard(
                        title: "No transactions to tag",
                        message: "Tag recent transactions to build reason patterns."
                    )
                } else {
                    ForEach(data.taggedTransactions) { transaction in
                        transactionRow(transaction)
                    }
                }
            }
        }
    }

    private func transactionRow(_ transaction: BehavioralResponse.TaggedTransaction) -> some View {
        let pending = viewModel.pendingTransactionId == transaction.id

        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(transaction.merchant)
                        .font(.subheadline.weight(.semibold))
                    Text(transaction.date)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }
                Spacer()
                MoneyText(amount: transaction.amount, font: .subheadline.weight(.bold))
            }

            FlowLayout(spacing: 6) {
                ForEach(defaultReasons) { reason in
                    let active = viewModel.activeReason(for: transaction) == reason.id
                    Button {
                        Task {
                            await viewModel.toggleReason(
                                for: transaction,
                                reasonId: reason.id,
                                api: appState.apiClient
                            )
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(reason.emoji)
                            Text(reason.label)
                        }
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(active ? reason.color : SpendFlowTheme.surface, in: Capsule())
                        .overlay(Capsule().stroke(active ? reason.color : SpendFlowTheme.border))
                        .foregroundStyle(active ? .white : SpendFlowTheme.textMuted)
                    }
                    .buttonStyle(.plain)
                    .disabled(pending)
                }
            }
        }
        .padding(12)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))
        .overlay(RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM).stroke(SpendFlowTheme.border))
    }

    private var reasonsBreakdown: some View {
        let breakdown = defaultReasons
            .map { ($0, viewModel.reasonTotals[$0.id] ?? 0) }
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
        let maxReason = breakdown.map(\.1).max() ?? 1

        return SpendFlowCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Spend by reason (30 days)")
                    .font(.headline)
                if breakdown.isEmpty {
                    FeatureEmptyCard(
                        title: "No tagged spend yet",
                        message: "Tag purchases with why you bought them to see spend-by-reason."
                    )
                } else {
                    ForEach(breakdown, id: \.0.id) { reason, total in
                        ProgressBarRow(
                            label: "\(reason.emoji) \(reason.label)",
                            value: total,
                            maxValue: maxReason,
                            color: reason.color,
                            trailing: MoneyFormatter.format(String(format: "%.2f", total))
                        )
                    }
                }
            }
        }
    }

    private func streaksSection(_ streaks: [BehavioralResponse.Streak]) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Habit streaks")
                    .font(.headline)
                if streaks.isEmpty {
                    FeatureEmptyCard(
                        title: "No streaks yet",
                        message: "Streaks track no-spend days, positive savings months, and time since dining spend."
                    )
                } else {
                    ForEach(streaks) { streak in
                        let color = Color(hex: streak.color ?? "#22C55E")
                        ProgressBarRow(
                            label: streak.label,
                            value: Double(streak.currentDays),
                            maxValue: Double(max(streak.maxDays, 1)),
                            color: color,
                            trailing: "\(streak.currentDays) day streak"
                        )
                    }
                }
            }
        }
    }

    private func challengesSection(_ challenges: [BehavioralResponse.Challenge]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Active challenges")
                .font(.caption.weight(.bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
                .textCase(.uppercase)

            if challenges.isEmpty {
                FeatureEmptyCard(
                    title: "No challenges yet",
                    message: "Personalized challenges appear once there is enough spending history."
                )
            } else {
                ForEach(challenges) { challenge in
                    SpendFlowCard {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(challenge.title)
                                        .font(.subheadline.weight(.semibold))
                                    Text(challenge.goal)
                                        .font(.caption)
                                        .foregroundStyle(SpendFlowTheme.textMuted)
                                }
                                Spacer()
                                if challenge.complete {
                                    Text("Complete!")
                                        .font(.caption2.weight(.bold))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(SpendFlowTheme.success.opacity(0.15), in: Capsule())
                                        .foregroundStyle(SpendFlowTheme.success)
                                } else {
                                    Text("\(challenge.daysRemaining)d left")
                                        .font(.caption)
                                        .foregroundStyle(SpendFlowTheme.textMuted)
                                }
                            }
                            ProgressBarRow(
                                label: "",
                                value: challenge.progressPercent,
                                color: Color(hex: challenge.color ?? "#3B82F6"),
                                trailing: "\(Int(challenge.progressPercent))%"
                            )
                        }
                    }
                }
            }
        }
    }
}

/// Simple wrapping horizontal layout for reason chips.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, frame) in result.frames.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var frames: [CGRect] = []

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (CGSize(width: maxWidth, height: y + rowHeight), frames)
    }
}
