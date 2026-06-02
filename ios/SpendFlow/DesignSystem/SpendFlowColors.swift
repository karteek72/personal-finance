import SwiftUI

enum SpendFlowColors {
    static let primary = Color("Primary")
    static let danger = Color("Danger")
    static let success = Color("Success")
    static let warning = Color("Warning")
    static let background = Color("Background")
    static let surface = Color("Surface")
    static let border = Color("Border")
    static let textPrimary = Color.primary
    static let textMuted = Color.secondary

    static let heroGradient = LinearGradient(
        colors: [
            Color(red: 0.004, green: 0.412, blue: 0.435),
            Color(red: 0.310, green: 0.596, blue: 0.639),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum CategoryColor {
    private static let palette: [String: Color] = [
        "food-groceries": Color(hex: "#3B82F6"),
        "dining": Color(hex: "#F97316"),
        "transport": Color(hex: "#6B7280"),
        "entertainment": Color(hex: "#A855F7"),
        "shopping": Color(hex: "#22C55E"),
        "utilities": Color(hex: "#6366F1"),
        "health": Color(hex: "#EC4899"),
        "travel": Color(hex: "#14B8A6"),
        "subscriptions": Color(hex: "#EF4444"),
        "home-rent": Color(hex: "#EAB308"),
        "education": Color(hex: "#8B5CF6"),
        "personal-care": Color(hex: "#F43F5E"),
        "financial": Color(hex: "#64748B"),
        "income": Color(hex: "#437a22"),
        "transfers": Color(hex: "#01696f"),
    ]

    static func forCategory(_ name: String) -> Color {
        let key = name
            .lowercased()
            .replacingOccurrences(of: " & ", with: "-")
            .replacingOccurrences(of: " ", with: "-")
        return palette[key] ?? SpendFlowColors.primary
    }
}

private extension Color {
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
