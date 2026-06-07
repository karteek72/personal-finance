import Foundation

struct ImportFormatInfo: Codable, Identifiable, Sendable {
    var id: String
    let label: String
    let extensions: [String]
    let description: String
    let brokers: [String]
}

struct ImportFormatsResponse: Codable, Sendable {
    struct Limits: Codable, Sendable {
        let maxFiles: Int
        let maxFileBytes: Int
        let maxBatchBytes: Int
    }

    let formats: [ImportFormatInfo]
    let limits: Limits
    let consentVersion: String
}

struct ImportBatchCreateResponse: Codable, Sendable {
    let batchId: String
    let status: String
    let filesTotal: Int
    let message: String
}

struct ImportActiveBatchResponse: Codable, Sendable {
    let activeBatchId: String?
    let status: String?
    let filesTotal: Int?
    let createdAt: String?
}

struct ImportFilePreviewSummary: Codable, Sendable {
    struct Account: Codable, Sendable {
        let institutionName: String
        let mask: String
        let type: String
        let subtype: String
        let matchedAccountId: String?
        let bankingCount: Int
        let investmentCount: Int
    }

    struct DateRange: Codable, Sendable {
        let min: String?
        let max: String?
    }

    struct SampleTransaction: Codable, Sendable {
        let date: String
        let name: String
        let amount: String
    }

    let accounts: [Account]
    let dateRange: DateRange
    let sampleTransactions: [SampleTransaction]
}

struct ImportBatchSummary: Codable, Sendable {
    let total: Int
    let pending: Int
    let ready: Int
    let failed: Int
    let imported: Int
    let bankingTransactions: Int
    let investmentTransactions: Int
    let canRetryFailed: Bool
    let canConfirm: Bool
}

struct ImportBatchStatusResponse: Codable, Sendable {
    struct Batch: Codable, Sendable {
        let id: String
        let status: String
        let filesTotal: Int
        let filesProcessed: Int
        let txnsInserted: Int
        let txnsSkipped: Int
        let errorMessage: String?
        let createdAt: String
        let completedAt: String?
    }

    struct File: Codable, Identifiable, Sendable {
        let id: String
        let filename: String
        let format: String
        let byteSize: Int
        let status: String
        let errorMessage: String?
        let canRetry: Bool
        let canReplace: Bool
        let preview: ImportFilePreviewSummary?
    }

    let batch: Batch
    let summary: ImportBatchSummary
    let files: [File]
}

struct ImportConfirmResponse: Codable, Sendable {
    let batchId: String
    let status: String
    let txnsInserted: Int
    let txnsSkipped: Int
    let filesImported: Int
    let message: String
}

struct StatusResponse: Codable, Sendable {
    let status: String
}

struct HouseholdNameResponse: Codable, Sendable {
    let id: String
    let name: String
}

struct AssignAccountResponse: Codable, Sendable {
    let accountId: String
    let memberId: String
}
