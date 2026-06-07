import SwiftUI

enum AnalyticsUI {
    static func scoreColor(_ score: Double) -> Color {
        if score >= 80 { SpendFlowTheme.success }
        else if score >= 60 { SpendFlowTheme.warning }
        else { SpendFlowTheme.danger }
    }

    static func scoreLabel(_ score: Double) -> String {
        if score >= 85 { "Excellent" }
        else if score >= 70 { "Good" }
        else if score >= 55 { "Fair" }
        else { "Needs Work" }
    }

    static func resilienceVerdict(_ score: Double) -> String {
        if score >= 80 { "Protected" }
        else if score >= 50 { "Exposed" }
        else { "Vulnerable" }
    }

    static func severityColor(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "high": SpendFlowTheme.danger
        case "medium": SpendFlowTheme.warning
        default: SpendFlowTheme.success
        }
    }

    static func shortMonth(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count >= 2, let monthNum = Int(parts[1]), monthNum >= 1, monthNum <= 12 else {
            return month
        }
        let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return names[monthNum - 1]
    }

    static func parseAmount(_ value: String) -> Double {
        Double(value.replacingOccurrences(of: "[^0-9.-]", with: "", options: .regularExpression)) ?? 0
    }
}

struct ScoreRingView: View {
    let score: Double
    var maxScore: Double = 100
    var lineWidth: CGFloat = 10
    var size: CGFloat = 120
    var color: Color? = nil
    var textColor: Color = SpendFlowTheme.text
    var mutedTextColor: Color = SpendFlowTheme.textMuted
    var showLabel: Bool = true

    var body: some View {
        ZStack {
            Circle()
                .stroke(SpendFlowTheme.border.opacity(textColor == .white ? 0.25 : 1), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(score / maxScore, 1))
                .stroke(
                    color ?? AnalyticsUI.scoreColor(score),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(Int(score.rounded()))")
                    .font(.system(size: size * 0.28, weight: .heavy, design: .rounded).monospacedDigit())
                    .foregroundStyle(textColor)
                if showLabel {
                    Text(AnalyticsUI.scoreLabel(score))
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(mutedTextColor)
                }
            }
        }
        .frame(width: size, height: size)
    }
}

struct FeatureEmptyCard: View {
    let title: String
    let message: String

    var body: some View {
        SpendFlowCard {
            VStack(spacing: 8) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(SpendFlowTheme.text)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct HeroGradientCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SpendFlowTheme.heroGradient, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
    }
}

struct ProgressBarRow: View {
    let label: String
    let value: Double
    var maxValue: Double = 100
    var color: Color = SpendFlowTheme.primary
    var trailing: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.text)
                }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(SpendFlowTheme.border)
                    Capsule()
                        .fill(color)
                        .frame(width: geo.size.width * min(value / maxValue, 1))
                }
            }
            .frame(height: 6)
        }
    }
}
