import SwiftUI

struct FamilyMemberMetricsView: View {
    let members: [HouseholdMemberInsight]
    let periodLabel: String

    private var membersWithAccounts: [HouseholdMemberInsight] {
        members.filter { $0.accountCount > 0 }
    }

    var body: some View {
        if members.count <= 1 || membersWithAccounts.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Family breakdown")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(SpendFlowTheme.text)
                    Text("Income vs spending by member · \(periodLabel)")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                }

                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 280), spacing: 12)],
                    spacing: 12
                ) {
                    ForEach(membersWithAccounts) { member in
                        memberCard(member)
                    }
                }
            }
        }
    }

    private func memberCard(_ member: HouseholdMemberInsight) -> some View {
        let spent = AnalyticsUI.parseAmount(member.totalSpent)
        let income = AnalyticsUI.parseAmount(member.totalIncome)
        let net = income - spent
        let maxValue = max(spent, income, 1)

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 10) {
                Circle()
                    .fill(Color(hex: member.avatarColor))
                    .frame(width: 36, height: 36)
                    .overlay {
                        Text(String(member.displayName.prefix(1)).uppercased())
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(member.displayName)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(SpendFlowTheme.text)
                        .lineLimit(1)
                    Text("\(member.accountCount) account\(member.accountCount == 1 ? "" : "s")")
                        .font(.caption2)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                        .lineLimit(1)
                }
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

                netColumn(net: net)
            }

            HStack(alignment: .top, spacing: 12) {
                metricColumn(title: "INCOME", amount: member.totalIncome, color: SpendFlowTheme.success)
                Spacer(minLength: 8)
                metricColumn(title: "SPENT", amount: member.totalSpent, color: SpendFlowTheme.danger, alignment: .trailing)
            }

            barRow(label: "In", value: income / maxValue, color: SpendFlowTheme.success)
            barRow(label: "Out", value: spent / maxValue, color: SpendFlowTheme.danger)
        }
        .padding(14)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.6), lineWidth: 1)
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color(hex: member.avatarColor))
                .frame(height: 3)
                .clipShape(RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        }
    }

    private func netColumn(net: Double) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("NET")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
            MoneyText(
                amount: String(format: "%.2f", net),
                font: .subheadline.weight(.bold).monospacedDigit()
            )
            .foregroundStyle(net >= 0 ? SpendFlowTheme.success : SpendFlowTheme.danger)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }
        .frame(minWidth: 88, alignment: .trailing)
        .fixedSize(horizontal: true, vertical: false)
    }

    private func metricColumn(
        title: String,
        amount: String,
        color: Color,
        alignment: HorizontalAlignment = .leading
    ) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(title)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(SpendFlowTheme.textMuted)
            MoneyText(amount: amount, font: .caption.weight(.bold).monospacedDigit())
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    private func barRow(label: String, value: Double, color: Color) -> some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(color)
                .frame(width: 24, alignment: .leading)
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(SpendFlowTheme.border.opacity(0.35))
                    Capsule()
                        .fill(color)
                        .frame(width: geometry.size.width * min(1, max(0, value)))
                }
            }
            .frame(height: 6)
        }
    }
}
