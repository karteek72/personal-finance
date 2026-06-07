import Foundation

extension APIClient {
    func getImportFormats() async throws -> ImportFormatsResponse {
        try await send(APIRequest(path: "/imports/formats"))
    }

    func getActiveImportBatch() async throws -> ImportActiveBatchResponse {
        try await send(APIRequest(path: "/imports/batches/active"))
    }

    func uploadImportBatch(
        files: [(filename: String, data: Data, mimeType: String)],
        consentAccepted: Bool
    ) async throws -> ImportBatchCreateResponse {
        let fields = ["consentAccepted": consentAccepted ? "true" : "false"]
        let fileParts = files.map { file in
            (name: "files", filename: file.filename, mimeType: file.mimeType, data: file.data)
        }
        return try await uploadMultipart(
            path: "/imports/batches",
            method: .post,
            fields: fields,
            files: fileParts
        )
    }

    func getImportBatch(batchId: String) async throws -> ImportBatchStatusResponse {
        try await send(APIRequest(path: "/imports/batches/\(batchId)"))
    }

    func confirmImportBatch(
        batchId: String,
        accountMappings: [String: String]? = nil,
        fileIds: [String]? = nil
    ) async throws -> ImportConfirmResponse {
        struct Body: Encodable {
            var accountMappings: [String: String]?
            var fileIds: [String]?
        }
        let body = try JSONEncoder.api.encode(Body(accountMappings: accountMappings, fileIds: fileIds))
        return try await send(
            APIRequest(path: "/imports/batches/\(batchId)/confirm", method: .post, body: body)
        )
    }

    func retryFailedImportFiles(batchId: String) async throws -> ImportRetryBatchResponse {
        try await send(APIRequest(path: "/imports/batches/\(batchId)/retry-failed", method: .post))
    }

    func retryImportFile(batchId: String, fileId: String) async throws -> ImportRetryFileResponse {
        try await send(
            APIRequest(path: "/imports/batches/\(batchId)/files/\(fileId)/retry", method: .post)
        )
    }

    func cancelImportBatch(batchId: String) async throws {
        let token = await MainActor.run { authService?.accessToken }
        let (_, response) = try await rawSend(
            APIRequest(path: "/imports/batches/\(batchId)", method: .delete),
            accessToken: token
        )
        guard response.statusCode == 204 || (200 ... 299).contains(response.statusCode) else {
            throw APIError.httpStatus(response.statusCode, message: "Could not cancel import.")
        }
    }

    func uploadMultipart<T: Decodable>(
        path: String,
        method: HTTPMethod = .post,
        fields: [String: String] = [:],
        files: [(name: String, filename: String, mimeType: String, data: Data)]
    ) async throws -> T {
        let boundary = "SpendFlow-\(UUID().uuidString)"
        var body = Data()

        for (key, value) in fields {
            body.appendMultipartField(name: key, value: value, boundary: boundary)
        }

        for file in files {
            body.appendMultipartFile(
                name: file.name,
                filename: file.filename,
                mimeType: file.mimeType,
                data: file.data,
                boundary: boundary
            )
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        let token = await MainActor.run { authService?.accessToken }
        let trimmedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard let url = URL(string: trimmedPath, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method.rawValue
        urlRequest.httpBody = body
        urlRequest.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await urlSession.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.transport(URLError(.badServerResponse))
        }
        return try decodeSuccess(data: data, response: http)
    }
}

struct ImportRetryBatchResponse: Codable, Sendable {
    let batchId: String
    let retried: Int
    let message: String
}

struct ImportRetryFileResponse: Codable, Sendable {
    let batchId: String
    let fileId: String
    let message: String
}

private extension Data {
    mutating func appendMultipartField(name: String, value: String, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        append("\(value)\r\n".data(using: .utf8)!)
    }

    mutating func appendMultipartFile(
        name: String,
        filename: String,
        mimeType: String,
        data fileData: Data,
        boundary: String
    ) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append(
            "Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n"
                .data(using: .utf8)!
        )
        append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        append(fileData)
        append("\r\n".data(using: .utf8)!)
    }
}
