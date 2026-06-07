import SwiftUI
import UniformTypeIdentifiers

@MainActor
@Observable
final class StatementImportViewModel {
    var formats: ImportFormatsResponse?
    var batchStatus: ImportBatchStatusResponse?
    var isLoading = false
    var isUploading = false
    var errorMessage: String?
    var statusMessage: String?
    var consentAccepted = false
    var activeBatchId: String?

    func load(api: APIClient) async {
        isLoading = formats == nil
        errorMessage = nil
        defer { isLoading = false }

        do {
            formats = try await api.getImportFormats()
            let active = try await api.getActiveImportBatch()
            if let batchId = active.activeBatchId {
                activeBatchId = batchId
                batchStatus = try await api.getImportBatch(batchId: batchId)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func upload(files: [(filename: String, data: Data, mimeType: String)], api: APIClient, refresh: FinancialRefreshCenter) async {
        isUploading = true
        errorMessage = nil
        statusMessage = nil
        defer { isUploading = false }

        do {
            let result = try await api.uploadImportBatch(files: files, consentAccepted: consentAccepted)
            activeBatchId = result.batchId
            statusMessage = result.message
            refresh.bump()
            await pollBatch(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func pollBatch(api: APIClient) async {
        guard let batchId = activeBatchId else { return }
        do {
            batchStatus = try await api.getImportBatch(batchId: batchId)
            let status = batchStatus?.batch.status ?? ""
            if status == "pending" || status == "processing" {
                try await Task.sleep(for: .seconds(2))
                await pollBatch(api: api)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func confirm(api: APIClient, refresh: FinancialRefreshCenter) async {
        guard let batchId = activeBatchId else { return }
        do {
            let result = try await api.confirmImportBatch(batchId: batchId)
            statusMessage = result.message
            refresh.bump()
            await pollBatch(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct StatementImportView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = StatementImportViewModel()
    @State private var showPicker = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let status = viewModel.statusMessage {
                    Text(status)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SpendFlowTheme.success)
                }
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.danger)
                }

                if viewModel.isLoading, viewModel.formats == nil {
                    LoadingStateView(message: "Loading import formats…")
                } else if let formats = viewModel.formats {
                    formatsSection(formats)
                    consentSection(formats)
                    uploadSection
                    if let batch = viewModel.batchStatus {
                        batchStatusSection(batch)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Import Statements")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPicker) {
            DocumentPicker { urls in
                Task { await handlePickedFiles(urls) }
            }
        }
        .task(id: appState.refreshCenter.refreshToken) {
            await viewModel.load(api: appState.apiClient)
        }
    }

    @ViewBuilder
    private func formatsSection(_ formats: ImportFormatsResponse) -> some View {
        Text("Supported formats")
            .font(.headline)
        ForEach(formats.formats) { format in
            GlassCard {
                VStack(alignment: .leading, spacing: 4) {
                    Text(format.label)
                        .font(.subheadline.weight(.semibold))
                    Text(format.description)
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                    Text(format.extensions.joined(separator: ", "))
                        .font(.caption2.monospaced())
                    if !format.brokers.isEmpty {
                        Text("Brokers: \(format.brokers.joined(separator: ", "))")
                            .font(.caption2)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                }
            }
        }
        Text("Max \(formats.limits.maxFiles) files · \(formats.limits.maxFileBytes / 1_000_000) MB each")
            .font(.caption)
            .foregroundStyle(SpendFlowTheme.textMuted)
    }

    private func consentSection(_ formats: ImportFormatsResponse) -> some View {
        Toggle(isOn: $viewModel.consentAccepted) {
            Text("I agree to statement import (\(formats.consentVersion))")
                .font(.caption)
        }
        .toggleStyle(.switch)
    }

    private var uploadSection: some View {
        SpendFlowPrimaryButton(
            title: "Choose files to upload",
            isLoading: viewModel.isUploading
        ) {
            showPicker = true
        }
        .disabled(!viewModel.consentAccepted)
    }

    @ViewBuilder
    private func batchStatusSection(_ status: ImportBatchStatusResponse) -> some View {
        Text("Batch status")
            .font(.headline)
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(status.batch.status.capitalized)
                    .font(.subheadline.weight(.semibold))
                Text("\(status.batch.filesProcessed)/\(status.batch.filesTotal) files processed")
                    .font(.caption)
                if status.summary.canConfirm {
                    SpendFlowPrimaryButton(title: "Confirm import") {
                        Task {
                            await viewModel.confirm(api: appState.apiClient, refresh: appState.refreshCenter)
                        }
                    }
                }
            }
        }

        ForEach(status.files) { file in
            GlassCard {
                VStack(alignment: .leading, spacing: 4) {
                    Text(file.filename)
                        .font(.subheadline.weight(.semibold))
                    Text("\(file.format) · \(file.status)")
                        .font(.caption)
                        .foregroundStyle(SpendFlowTheme.textMuted)
                    if let error = file.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.danger)
                    }
                }
            }
        }
    }

    private func handlePickedFiles(_ urls: [URL]) async {
        var files: [(filename: String, data: Data, mimeType: String)] = []
        for url in urls {
            guard url.startAccessingSecurityScopedResource() else { continue }
            defer { url.stopAccessingSecurityScopedResource() }
            guard let data = try? Data(contentsOf: url) else { continue }
            let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            files.append((url.lastPathComponent, data, mime))
        }
        guard !files.isEmpty else {
            viewModel.errorMessage = "Could not read selected files."
            return
        }
        await viewModel.upload(files: files, api: appState.apiClient, refresh: appState.refreshCenter)
    }
}

struct DocumentPicker: UIViewControllerRepresentable {
    let onPick: ([URL]) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let types: [UTType] = [.pdf, .commaSeparatedText, .data, .xml]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.allowsMultipleSelection = true
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick)
    }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: ([URL]) -> Void

        init(onPick: @escaping ([URL]) -> Void) {
            self.onPick = onPick
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            onPick(urls)
        }
    }
}
