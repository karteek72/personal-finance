import SwiftUI

private struct CoachChatMessage: Identifiable, Sendable {
    let id = UUID()
    let role: Role
    let text: String

    enum Role: Sendable {
        case user
        case coach
    }
}

@MainActor
@Observable
final class CoachViewModel {
    var data: CoachResponse?
    var messages: [CoachChatMessage] = []
    var draftQuestion = ""
    var isLoading = false
    var isAsking = false
    var errorMessage: String?

    private let starterChips = [
        "How can I save more this month?",
        "What's my biggest spending leak?",
        "Am I on track for my goals?",
        "How is my cash flow looking?",
    ]

    var chips: [String] { starterChips }

    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            data = try await api.getCoach()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func ask(_ question: String, api: APIClient) async {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        messages.append(CoachChatMessage(role: .user, text: trimmed))
        draftQuestion = ""
        isAsking = true
        defer { isAsking = false }

        do {
            let response = try await api.askCoach(question: trimmed)
            messages.append(CoachChatMessage(role: .coach, text: response.answer))
        } catch {
            errorMessage = error.localizedDescription
            messages.append(CoachChatMessage(role: .coach, text: "Sorry — I couldn't answer that right now."))
        }
    }
}

struct CoachView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = CoachViewModel()

    var body: some View {
        SpendFlowScreen(title: "Coach", subtitle: "Guided insights from your data") {
            if viewModel.isLoading, viewModel.data == nil {
                LoadingStateView(message: "Loading coach…")
            } else if let error = viewModel.errorMessage, viewModel.data == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: appState.apiClient) }
                }
            } else {
                if let data = viewModel.data {
                    narrativeSection(data)
                }
                askCoachSection
            }
        }
        .refreshable {
            await viewModel.load(api: appState.apiClient)
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    private func narrativeSection(_ data: CoachResponse) -> some View {
        VStack(spacing: 12) {
            HStack {
                Text("Monthly narrative")
                    .font(.headline)
                Spacer()
                if let isLive = data.isLive {
                    MetricLiveBadge(isLive: isLive)
                }
            }
            GlassCard {
                Text(data.narrative).font(.subheadline)
            }
            GlassCard {
                Text(data.forecast)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)
            }
            ForEach(data.qa) { item in
                GlassCard {
                    Text(item.q).font(.caption.weight(.semibold))
                    Text(item.a).font(.caption)
                }
            }
        }
    }

    private var askCoachSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ask Coach")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(viewModel.chips, id: \.self) { chip in
                        Button {
                            viewModel.draftQuestion = chip
                        } label: {
                            Text(chip)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(SpendFlowTheme.surface, in: Capsule())
                                .overlay(Capsule().stroke(SpendFlowTheme.border))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            ForEach(viewModel.messages) { message in
                HStack {
                    if message.role == .coach { Spacer(minLength: 24) }
                    Text(message.text)
                        .font(.caption)
                        .padding(12)
                        .background(
                            message.role == .user ? SpendFlowTheme.primarySoft : SpendFlowTheme.surface,
                            in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM)
                        )
                    if message.role == .user { Spacer(minLength: 24) }
                }
            }

            HStack(spacing: 8) {
                TextField("Ask a question…", text: $viewModel.draftQuestion, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1 ... 3)
                Button {
                    Task { await viewModel.ask(viewModel.draftQuestion, api: appState.apiClient) }
                } label: {
                    if viewModel.isAsking {
                        ProgressView()
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                }
                .disabled(viewModel.isAsking || viewModel.draftQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }
}
