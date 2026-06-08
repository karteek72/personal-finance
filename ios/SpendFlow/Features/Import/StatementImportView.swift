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
    var accountMappings: [String: String] = [:]
    var replaceTargetFileId: String?

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
            let mappings = accountMappings.isEmpty ? nil : accountMappings
            let result = try await api.confirmImportBatch(batchId: batchId, accountMappings: mappings)
            statusMessage = result.message
            refresh.bump()
            await pollBatch(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func retryFile(batchId: String, fileId: String, api: APIClient) async {
        do {
            let result = try await api.retryImportFile(batchId: batchId, fileId: fileId)
            statusMessage = result.message
            await pollBatch(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func retryFailed(api: APIClient) async {
        guard let batchId = activeBatchId else { return }
        do {
            let result = try await api.retryFailedImportFiles(batchId: batchId)
            statusMessage = result.message
            await pollBatch(api: api)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func cancelBatch(api: APIClient) async {
        guard let batchId = activeBatchId else { return }
        do {
            try await api.cancelImportBatch(batchId: batchId)
            activeBatchId = nil
            batchStatus = nil
            statusMessage = "Import cancelled."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func replaceFile(
        batchId: String,
        fileId: String,
        filename: String,
        data: Data,
        mimeType: String,
        api: APIClient
    ) async {
        do {
            let result = try await api.replaceImportFile(
                batchId: batchId,
                fileId: fileId,
                filename: filename,
                data: data,
                mimeType: mimeType
            )
            statusMessage = result.message
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
    @State private var showReplacePicker = false

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
        .sheet(isPresented: $showReplacePicker) {
            DocumentPicker { urls in
                Task { await handleReplaceFile(urls) }
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

                HStack(spacing: 8) {
                    if status.summary.canRetryFailed {
                        Button("Retry failed") {
                            Task { await viewModel.retryFailed(api: appState.apiClient) }
                        }
                        .font(.caption.weight(.semibold))
                    }
                    Button("Cancel batch", role: .destructive) {
                        Task { await viewModel.cancelBatch(api: appState.apiClient) }
                    }
                    .font(.caption.weight(.semibold))
                }

                if status.summary.canConfirm {
                    accountMappingSection(status)
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
                VStack(alignment: .leading, spacing: 8) {
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
                    HStack(spacing: 12) {
                        if file.canRetry, let batchId = viewModel.activeBatchId {
                            Button("Retry") {
                                Task { await viewModel.retryFile(batchId: batchId, fileId: file.id, api: appState.apiClient) }
                            }
                            .font(.caption.weight(.semibold))
                        }
                        if file.canReplace {
                            Button("Replace") {
                                viewModel.replaceTargetFileId = file.id
                                showReplacePicker = true
                            }
                            .font(.caption.weight(.semibold))
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func accountMappingSection(_ status: ImportBatchStatusResponse) -> some View {
        let accounts = status.files.flatMap { $0.preview?.accounts ?? [] }
        if !accounts.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Map parsed accounts")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(SpendFlowTheme.textMuted)
                ForEach(Array(accounts.enumerated()), id: \.offset) { index, account in
                    let key = "\(account.institutionName)-\(account.mask)-\(index)"
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(account.institutionName) •••• \(account.mask) (\(account.subtype))")
                            .font(.caption)
                        TextField(
                            "Account ID to import into",
                            text: Binding(
                                get: { viewModel.accountMappings[key] ?? account.matchedAccountId ?? "" },
                                set: { viewModel.accountMappings[key] = $0.isEmpty ? nil : $0 }
                            )
                        )
                        .textFieldStyle(.roundedBorder)
                        .font(.caption)
                    }
                }
            }
        }
    }

    private func handleReplaceFile(_ urls: [URL]) async {
        guard let fileId = viewModel.replaceTargetFileId,
              let batchId = viewModel.activeBatchId,
              let url = urls.first else { return }
        guard url.startAccessingSecurityScopedResource() else { return }
        defer { url.stopAccessingSecurityScopedResource() }
        guard let data = try? Data(contentsOf: url) else { return }
        let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        await viewModel.replaceFile(
            batchId: batchId,
            fileId: fileId,
            filename: url.lastPathComponent,
            data: data,
            mimeType: mime,
            api: appState.apiClient
        )
        viewModel.replaceTargetFileId = nil
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
