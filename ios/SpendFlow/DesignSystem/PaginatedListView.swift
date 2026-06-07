import SwiftUI

/// Server-driven paginated list using the standard `Page<T>` contract.
struct PaginatedListView<Row: Identifiable & Sendable, Content: View>: View {
    let title: String
    @Binding var query: ListQuery
    let rows: [Row]
    let page: Int
    let totalPages: Int
    let isLoading: Bool
    let errorMessage: String?
    let onReload: () -> Void
    let onNextPage: () -> Void
    let onPreviousPage: () -> Void
    let onSearch: (String) -> Void
    @ViewBuilder let rowContent: (Row) -> Content

    @State private var searchText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.headline)
                Spacer()
                if isLoading {
                    ProgressView()
                }
            }

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(SpendFlowTheme.textMuted)
                TextField("Search", text: $searchText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit {
                        onSearch(searchText)
                    }
                if !searchText.isEmpty {
                    Button("Go") {
                        onSearch(searchText)
                    }
                    .font(.caption.weight(.semibold))
                }
            }
            .padding(10)
            .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusSM))

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.danger)
            }

            if rows.isEmpty, !isLoading {
                ContentUnavailableView("No results", systemImage: "tray")
            } else {
                List(rows) { row in
                    rowContent(row)
                }
                .listStyle(.plain)
                .frame(minHeight: 200, maxHeight: 360)
            }

            HStack {
                Button("Previous") {
                    onPreviousPage()
                }
                .disabled(page <= 1 || isLoading)

                Spacer()

                Text("Page \(page) of \(max(totalPages, 1))")
                    .font(.caption)
                    .foregroundStyle(SpendFlowTheme.textMuted)

                Spacer()

                Button("Next") {
                    onNextPage()
                }
                .disabled(page >= totalPages || isLoading)
            }
            .font(.subheadline.weight(.semibold))
        }
        .padding(16)
        .background(SpendFlowTheme.surface, in: RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: SpendFlowTheme.radiusCard)
                .stroke(SpendFlowTheme.border.opacity(0.5), lineWidth: 1)
        )
        .refreshable {
            onReload()
        }
        .onAppear {
            if rows.isEmpty {
                onReload()
            }
        }
    }
}
