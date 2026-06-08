import SwiftUI

/// Matches `ui/src/styles/tokens.css` — purple / pink Gen Z palette.
enum SpendFlowTheme {
    // MARK: - Brand (light)

    static let primary = Color(hex: "#7C3AED")
    static let primarySoft = Color(hex: "#EDE9FE")
    static let accent = Color(hex: "#F472B6")
    static let danger = Color(hex: "#EF4444")
    static let success = Color(hex: "#22C55E")
    static let warning = Color(hex: "#F59E0B")
    static let background = Color(hex: "#F8F7FF")
    static let surface = Color.white
    static let border = Color(hex: "#E8E5F0")
    static let text = Color(hex: "#1A1625")
    static let textMuted = Color(hex: "#6B6578")

    // MARK: - Layout

    static let radiusSM: CGFloat = 10
    static let radiusCard: CGFloat = 16
    static let radiusLG: CGFloat = 24

    static let heroGradient = LinearGradient(
        colors: [Color(hex: "#7C3AED"), Color(hex: "#A855F7"), Color(hex: "#EC4899")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let subtleGradient = LinearGradient(
        colors: [Color(hex: "#F8F7FF"), Color.white],
        startPoint: .top,
        endPoint: .bottom
    )

    static let meshBackground = LinearGradient(
        colors: [
            Color(hex: "#F8F7FF"),
            Color(hex: "#EDE9FE").opacity(0.6),
            Color(hex: "#FCE7F3").opacity(0.4),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static func cardShadow(radius: CGFloat = 12, y: CGFloat = 4) -> some View {
        Color.clear.shadow(color: primary.opacity(0.08), radius: radius, x: 0, y: y)
    }
}

enum SpendFlowColors {
    static var primary: Color { SpendFlowTheme.primary }
    static var primarySoft: Color { SpendFlowTheme.primarySoft }
    static var accent: Color { SpendFlowTheme.accent }
    static var danger: Color { SpendFlowTheme.danger }
    static var success: Color { SpendFlowTheme.success }
    static var warning: Color { SpendFlowTheme.warning }
    static var background: Color { SpendFlowTheme.background }
    static var surface: Color { SpendFlowTheme.surface }
    static var border: Color { SpendFlowTheme.border }
    static var textPrimary: Color { SpendFlowTheme.text }
    static var textMuted: Color { SpendFlowTheme.textMuted }
    static var heroGradient: LinearGradient { SpendFlowTheme.heroGradient }
}

enum CategoryColor {
    private static let palette: [String: Color] = [
        "food-groceries": Color(hex: "#3B82F6"),
        "food-&-groceries": Color(hex: "#3B82F6"),
        "dining": Color(hex: "#F97316"),
        "dining-&-restaurants": Color(hex: "#F97316"),
        "transport": Color(hex: "#6B7280"),
        "transportation": Color(hex: "#6B7280"),
        "entertainment": Color(hex: "#A855F7"),
        "shopping": Color(hex: "#22C55E"),
        "shopping-&-retail": Color(hex: "#22C55E"),
        "utilities": Color(hex: "#6366F1"),
        "utilities-&-bills": Color(hex: "#6366F1"),
        "health": Color(hex: "#EC4899"),
        "health-&-medical": Color(hex: "#EC4899"),
        "travel": Color(hex: "#14B8A6"),
        "subscriptions": Color(hex: "#EF4444"),
        "subscriptions-&-software": Color(hex: "#EF4444"),
        "home-rent": Color(hex: "#EAB308"),
        "housing": Color(hex: "#EAB308"),
        "housing-&-home": Color(hex: "#EAB308"),
        "education": Color(hex: "#8B5CF6"),
        "personal-care": Color(hex: "#F43F5E"),
        "financial": Color(hex: "#64748B"),
        "financial-&-insurance": Color(hex: "#64748B"),
        "family-kids": Color(hex: "#FB923C"),
        "pet": Color(hex: "#84CC16"),
        "gifts-donations": Color(hex: "#E879F9"),
        "business-professional": Color(hex: "#94A3B8"),
        "income": Color(hex: "#437A22"),
        "transfers": Color(hex: "#01696F"),
    ]

    static func forCategory(_ name: String) -> Color {
        let key = normalizedKey(name)
        if let color = palette[key] {
            return color
        }
        return ChartPalette.color(at: ChartPalette.stableIndex(for: key))
    }

    private static func normalizedKey(_ name: String) -> String {
        name
            .lowercased()
            .replacingOccurrences(of: " & ", with: "-&-")
            .replacingOccurrences(of: " ", with: "-")
    }
}

/// Shared chart colors — mirrors `design-tokens.json` `investments.chartPalette`.
enum ChartPalette {
    static let series: [Color] = [
        Color(hex: "#7C3AED"),
        Color(hex: "#EC4899"),
        Color(hex: "#3B82F6"),
        Color(hex: "#F97316"),
        Color(hex: "#22C55E"),
        Color(hex: "#14B8A6"),
        Color(hex: "#EAB308"),
        Color(hex: "#EF4444"),
        Color(hex: "#6366F1"),
        Color(hex: "#84CC16"),
        Color(hex: "#F43F5E"),
        Color(hex: "#0EA5E9"),
    ]

    private static let semantic: [String: Color] = [
        "winners": SpendFlowTheme.success,
        "losers": SpendFlowTheme.danger,
        "stocks": Color(hex: "#3B82F6"),
        "stocks-&-etfs": Color(hex: "#3B82F6"),
        "options": Color(hex: "#8B5CF6"),
        "other": Color(hex: "#94A3B8"),
        "crypto": Color(hex: "#F59E0B"),
        "bonds": Color(hex: "#64748B"),
        "communication-services": Color(hex: "#6366F1"),
        "consumer-discretionary": Color(hex: "#F97316"),
        "consumer-staples": Color(hex: "#22C55E"),
        "energy": Color(hex: "#EAB308"),
        "financials": Color(hex: "#64748B"),
        "health-care": Color(hex: "#EC4899"),
        "industrials": Color(hex: "#6B7280"),
        "information-technology": Color(hex: "#3B82F6"),
        "materials": Color(hex: "#A16207"),
        "real-estate": Color(hex: "#14B8A6"),
        "utilities": Color(hex: "#0EA5E9"),
        "primary": SpendFlowTheme.primary,
        "side": SpendFlowTheme.success,
        "income": SpendFlowTheme.success,
        "expenses": SpendFlowTheme.danger,
        "spent": SpendFlowTheme.danger,
        "net": SpendFlowTheme.primary,
    ]

    static func color(forLabel label: String, index: Int) -> Color {
        let key = normalizedKey(label)
        if let color = semantic[key] {
            return color
        }
        return CategoryColor.forCategory(label)
    }

    static func color(at index: Int) -> Color {
        series[abs(index) % series.count]
    }

    static func stableIndex(for key: String) -> Int {
        abs(key.utf8.reduce(5381) { ($0 &* 33) &+ Int($1) }) % series.count
    }

    private static func normalizedKey(_ label: String) -> String {
        label
            .lowercased()
            .replacingOccurrences(of: " & ", with: "-&-")
            .replacingOccurrences(of: " ", with: "-")
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
