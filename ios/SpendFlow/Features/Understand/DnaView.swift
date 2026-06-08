import SwiftUI

@MainActor
@Observable
final class DnaViewModel {
    var data: DnaResponse?
    var isLoading = false
    var errorMessage: String?
    var showPeers = true

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getDna()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct DnaView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DnaViewModel()

    var body: some View {
        SpendFlowScreen(title: "Spending DNA", subtitle: "Your spending fingerprint") {
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
            LoadingStateView(message: "Reading your DNA…")
        } else if let error = viewModel.errorMessage, viewModel.data == nil {
            ErrorStateView(message: error) {
                Task { await viewModel.load(api: appState.apiClient) }
            }
        } else if let data = viewModel.data {
            if data.axes.isEmpty {
                FeatureEmptyCard(
                    title: "Not enough data yet",
                    message: "Sync more transactions to reveal your spending DNA."
                )
            } else {
                archetypeHero(data)
                radarSection(data)
                distinctiveTraits(data.axes)
                allDimensions(data.axes)
            }
        }
    }

    private func archetypeHero(_ data: DnaResponse) -> some View {
        HeroGradientCard {
            VStack(alignment: .leading, spacing: 6) {
                Text("Your spending fingerprint")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.7))
                    .textCase(.uppercase)
                Text(data.archetype)
                    .font(.title.weight(.heavy))
                    .foregroundStyle(.white)
                Text(data.narrative)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.85))
                if let rarity = data.peerRarity, !rarity.isEmpty {
                    Text(rarity)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
        }
    }

    private func radarSection(_ data: DnaResponse) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Spend DNA radar")
                        .font(.headline)
                    Spacer()
                    Button(viewModel.showPeers ? "Hide peers" : "Show peers") {
                        viewModel.showPeers.toggle()
                    }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        viewModel.showPeers ? SpendFlowTheme.primarySoft : SpendFlowTheme.surface,
                        in: Capsule()
                    )
                    .overlay(Capsule().stroke(SpendFlowTheme.border))
                }

                DnaRadarChart(axes: data.axes, showPeers: viewModel.showPeers)
                    .frame(height: 260)

                HStack(spacing: 16) {
                    Label("You", systemImage: "circle.fill")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.primary)
                    if viewModel.showPeers {
                        Label("Peers", systemImage: "circle.fill")
                            .font(.caption)
                            .foregroundStyle(Color(hex: "#94A3B8"))
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func distinctiveTraits(_ axes: [DnaResponse.Axis]) -> some View {
        let distinctive = axes
            .map { ($0, $0.you - $0.peers) }
            .sorted { abs($0.1) > abs($1.1) }
            .prefix(3)

        return SpendFlowCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("What makes you, you")
                    .font(.headline)
                ForEach(Array(distinctive.enumerated()), id: \.offset) { _, item in
                    HStack {
                        Text(item.0.label)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text("\(item.1 >= 0 ? "+" : "")\(Int(item.1.rounded())) vs peers")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(item.1 > 0 ? SpendFlowTheme.primary : SpendFlowTheme.textMuted)
                    }
                    .padding(.vertical, 6)
                }
            }
        }
    }

    private func allDimensions(_ axes: [DnaResponse.Axis]) -> some View {
        SpendFlowCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("All dimensions")
                    .font(.headline)
                ForEach(axes) { axis in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(axis.label)
                                .font(.caption)
                                .foregroundStyle(SpendFlowTheme.textMuted)
                            Spacer()
                            Text("\(Int(axis.you.rounded()))")
                                .font(.caption.weight(.semibold))
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(SpendFlowTheme.border)
                                Capsule()
                                    .fill(SpendFlowTheme.primary)
                                    .frame(width: geo.size.width * axis.you / 100)
                                if viewModel.showPeers {
                                    Rectangle()
                                        .fill(Color(hex: "#94A3B8"))
                                        .frame(width: 2, height: 12)
                                        .offset(x: geo.size.width * axis.peers / 100 - 1)
                                }
                            }
                        }
                        .frame(height: 8)
                    }
                }
            }
        }
    }
}

private struct DnaRadarChart: View {
    let axes: [DnaResponse.Axis]
    let showPeers: Bool

    private let radius: CGFloat = 100

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let scale = min(size.width, size.height) / (radius * 2.4)
            let n = axes.count
            guard n >= 3 else { return }

            for ring in [0.25, 0.5, 0.75, 1.0] {
                var path = Path()
                for i in 0..<n {
                    let point = axisPoint(index: i, count: n, factor: ring, center: center, scale: scale)
                    if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
                path.closeSubpath()
                context.stroke(path, with: .color(SpendFlowTheme.border), lineWidth: 1)
            }

            for i in 0..<n {
                let outer = axisPoint(index: i, count: n, factor: 1, center: center, scale: scale)
                var spoke = Path()
                spoke.move(to: center)
                spoke.addLine(to: outer)
                context.stroke(spoke, with: .color(SpendFlowTheme.border), lineWidth: 1)
            }

            if showPeers {
                let peerPath = polygonPath(values: axes.map(\.peers), center: center, scale: scale)
                context.fill(peerPath, with: .color(Color(hex: "#94A3B8").opacity(0.18)))
                context.stroke(peerPath, with: .color(Color(hex: "#94A3B8")), lineWidth: 1.5)
            }

            let youPath = polygonPath(values: axes.map(\.you), center: center, scale: scale)
            context.fill(youPath, with: .color(SpendFlowTheme.primary.opacity(0.25)))
            context.stroke(youPath, with: .color(SpendFlowTheme.primary), lineWidth: 2)

            for (i, axis) in axes.enumerated() {
                let labelPoint = axisPoint(index: i, count: n, factor: 1.18, center: center, scale: scale)
                context.draw(
                    Text(axis.label).font(.system(size: 9, weight: .semibold)),
                    at: labelPoint,
                    anchor: .center
                )
            }
        }
    }

    private func axisPoint(index: Int, count: Int, factor: Double, center: CGPoint, scale: CGFloat) -> CGPoint {
        let angle = (Double(index) / Double(count)) * 2 * .pi - .pi / 2
        let r = Double(radius) * factor * Double(scale)
        return CGPoint(
            x: center.x + CGFloat(Darwin.cos(angle) * r),
            y: center.y + CGFloat(Darwin.sin(angle) * r)
        )
    }

    private func polygonPath(values: [Double], center: CGPoint, scale: CGFloat) -> Path {
        var path = Path()
        for (i, value) in values.enumerated() {
            let point = axisPoint(index: i, count: values.count, factor: value / 100, center: center, scale: scale)
            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        path.closeSubpath()
        return path
    }
}
