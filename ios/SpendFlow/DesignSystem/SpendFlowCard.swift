import SwiftUI

// MARK: - Gradient brand text

struct GradientBrandText: View {
    let text: String
    var font: Font = .largeTitle.weight(.heavy)

    var body: some View {
        Text(text)
            .font(font)
            .foregroundStyle(
                LinearGradient(
                    colors: [Color(hex: "#7C3AED"), Color(hex: "#A855F7"), Color(hex: "#EC4899")],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
    }
}

// MARK: - Page chrome

struct SpendFlowPageBackground: View {
    var body: some View {
        SpendFlowTheme.meshBackground
            .ignoresSafeArea()
    }
}

struct SpendFlowScreen<Content: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        ZStack {
            SpendFlowPageBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundStyle(SpendFlowTheme.text)
                        if let subtitle {
                            Text(subtitle)
                                .font(.subheadline)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                        }
                    }
                    .padding(.top, 8)

                    content()
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 100)
            }
        }
    }
}

// MARK: - Glass card

struct GlassCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .background(
                        RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                            .fill(SpendFlowTheme.surface.opacity(0.85))
                    )
            }
            .overlay(
                RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard, style: .continuous)
                    .stroke(SpendFlowTheme.border.opacity(0.7), lineWidth: 1)
            )
            .shadow(color: SpendFlowTheme.primary.opacity(0.06), radius: 16, x: 0, y: 6)
    }
}

struct SpendFlowCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        GlassCard(content: content)
    }
}

// MARK: - Pill filter bar

struct PillFilterBar<Item: Hashable & Identifiable & Equatable>: View {
    let items: [Item]
    @Binding var selection: Item
    let label: (Item) -> String
    let emoji: ((Item) -> String)?

    init(
        items: [Item],
        selection: Binding<Item>,
        label: @escaping (Item) -> String,
        emoji: ((Item) -> String)? = nil
    ) {
        self.items = items
        _selection = selection
        self.label = label
        self.emoji = emoji
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items) { item in
                    let isSelected = item == selection
                    Button {
                        withAnimation(.spring(response: 0.32, dampingFraction: 0.78)) {
                            selection = item
                        }
                    } label: {
                        HStack(spacing: 4) {
                            if let emoji {
                                let emojiText = emoji(item)
                                if !emojiText.isEmpty {
                                    Text(emojiText).font(.caption)
                                }
                            }
                            Text(label(item))
                                .font(.caption.weight(.semibold))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background {
                            Capsule()
                                .fill(isSelected ? SpendFlowTheme.primary : SpendFlowTheme.surface)
                        }
                        .overlay {
                            Capsule()
                                .stroke(
                                    isSelected ? Color.clear : SpendFlowTheme.border,
                                    lineWidth: 1
                                )
                        }
                        .foregroundStyle(isSelected ? .white : SpendFlowTheme.textMuted)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 2)
        }
    }
}

// MARK: - Primary CTA

struct SpendFlowPrimaryButton: View {
    let title: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(.white)
                }
                Text(title)
                    .font(.subheadline.weight(.bold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(SpendFlowTheme.heroGradient)
            .foregroundStyle(.white)
            .clipShape(Capsule())
            .shadow(color: SpendFlowTheme.primary.opacity(0.35), radius: 12, x: 0, y: 6)
        }
        .disabled(isLoading)
    }
}

// MARK: - Floating tab bar

enum AppTab: String, CaseIterable, Identifiable {
    case home
    case flow
    case spend
    case activity
    case wallet
    case more

    var id: String { rawValue }

    var label: String {
        switch self {
        case .home: "Home"
        case .flow: "Flow"
        case .spend: "Spend"
        case .activity: "Activity"
        case .wallet: "Wallet"
        case .more: "More"
        }
    }

    var icon: String {
        switch self {
        case .home: "house.fill"
        case .flow: "waveform.path.ecg"
        case .spend: "circle.grid.3x3.fill"
        case .activity: "list.bullet.rectangle.fill"
        case .wallet: "creditcard.fill"
        case .more: "square.grid.2x2.fill"
        }
    }
}

struct FloatingTabBar: View {
    @Binding var selection: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                let isActive = selection == tab
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                        selection = tab
                    }
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 18, weight: isActive ? .bold : .medium))
                            .symbolEffect(.bounce, value: isActive)
                        Text(tab.label)
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .foregroundStyle(isActive ? SpendFlowTheme.primary : SpendFlowTheme.textMuted)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background {
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .fill(.ultraThinMaterial)
                .background(
                    RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                        .fill(SpendFlowTheme.surface.opacity(0.92))
                )
        }
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusLG, style: .continuous)
                .stroke(SpendFlowTheme.border.opacity(0.6), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.08), radius: 20, x: 0, y: 8)
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}

// MARK: - Category icon chip

struct CategoryChip: View {
    let color: Color
    var size: CGFloat = 40

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.32, style: .continuous)
            .fill(color.opacity(0.18))
            .frame(width: size, height: size)
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.32, style: .continuous)
                    .fill(color)
                    .frame(width: size * 0.35, height: size * 0.35)
            }
    }
}

// MARK: - Loading & error states

struct LoadingStateView: View {
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(SpendFlowTheme.primary)
                .scaleEffect(1.1)
            Text(message)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(SpendFlowTheme.textMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }
}

struct ErrorStateView: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 16) {
            Text("😅")
                .font(.largeTitle)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(SpendFlowTheme.danger)
                .multilineTextAlignment(.center)
            if let retry {
                SpendFlowPrimaryButton(title: "Try again", action: retry)
                    .frame(maxWidth: 200)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 220)
        .padding()
    }
}
