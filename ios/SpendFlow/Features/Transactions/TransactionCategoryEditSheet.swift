import SwiftUI

struct TransactionCategoryEditSheet: View {
    let transaction: Transaction
    let onSave: (String, String?, Bool) async throws -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var category: String
    @State private var subCategory: String?
    @State private var rememberForMerchant = true
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(
        transaction: Transaction,
        onSave: @escaping (String, String?, Bool) async throws -> Void
    ) {
        self.transaction = transaction
        self.onSave = onSave
        let normalized = SpendCategories.normalizedCategory(transaction.category)
        _category = State(initialValue: normalized)
        _subCategory = State(
            initialValue: SpendCategories.keptSubcategory(current: transaction.subCategory, for: normalized)
        )
    }

    private var displayName: String {
        transaction.merchantName ?? transaction.name
    }

    private var subcategoryOptions: [String] {
        SpendCategories.subcategories(for: category)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(displayName)
                            .font(.headline)
                        Text(transaction.date)
                            .font(.caption)
                            .foregroundStyle(SpendFlowTheme.textMuted)
                    }
                    .padding(.vertical, 4)
                }

                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(SpendCategories.all, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    .onChange(of: category) { _, newCategory in
                        subCategory = SpendCategories.keptSubcategory(current: subCategory, for: newCategory)
                    }

                    if !subcategoryOptions.isEmpty {
                        Picker("Subcategory", selection: subcategoryBinding) {
                            Text("None").tag("")
                            ForEach(subcategoryOptions, id: \.self) { option in
                                Text(option).tag(option)
                            }
                        }
                    }
                }

                Section {
                    Toggle("Remember for this merchant", isOn: $rememberForMerchant)
                } footer: {
                    Text("Future transactions from \(displayName) will use this category.")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(SpendFlowTheme.danger)
                    }
                }
            }
            .navigationTitle("Edit category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .disabled(isSaving || !hasChanges)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
        .presentationDetents([.medium, .large])
    }

    private var subcategoryBinding: Binding<String> {
        Binding(
            get: { subCategory ?? "" },
            set: { subCategory = $0.isEmpty ? nil : $0 }
        )
    }

    private var hasChanges: Bool {
        category != SpendCategories.normalizedCategory(transaction.category)
            || subCategory != transaction.subCategory
    }

    private func save() async {
        guard hasChanges else {
            dismiss()
            return
        }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            try await onSave(category, subCategory, rememberForMerchant)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
