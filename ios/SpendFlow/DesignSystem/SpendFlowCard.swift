import SwiftUI

struct SpendFlowCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SpendFlowColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(SpendFlowColors.border, lineWidth: 1)
            )
    }
}

struct LoadingStateView: View {
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(message)
                .font(.subheadline)
                .foregroundStyle(SpendFlowColors.textMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }
}

struct ErrorStateView: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            Text(message)
                .font(.subheadline)
                .foregroundStyle(SpendFlowColors.danger)
                .multilineTextAlignment(.center)
            if let retry {
                Button("Try again", action: retry)
                    .buttonStyle(.borderedProminent)
                    .tint(SpendFlowColors.primary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 200)
        .padding()
    }
}
