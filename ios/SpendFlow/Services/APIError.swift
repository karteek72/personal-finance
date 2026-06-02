import Foundation

struct APIErrorResponse: Decodable, Sendable {
    struct ErrorBody: Decodable, Sendable {
        let code: String?
        let message: String
    }

    let error: ErrorBody
}

enum APIError: LocalizedError, Sendable {
    case invalidURL
    case unauthenticated
    case httpStatus(Int, message: String)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .unauthenticated:
            return "Session expired. Please sign in again."
        case let .httpStatus(code, message):
            return message.isEmpty ? "Request failed (\(code))" : message
        case let .decoding(error):
            return "Unexpected response format: \(error.localizedDescription)"
        case let .transport(error):
            return error.localizedDescription
        }
    }
}

enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

struct APIRequest: Sendable {
    let path: String
    let method: HTTPMethod
    let queryItems: [URLQueryItem]
    let body: Data?
    let requiresAuth: Bool

    init(
        path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem] = [],
        body: Data? = nil,
        requiresAuth: Bool = true
    ) {
        self.path = path
        self.method = method
        self.queryItems = queryItems
        self.body = body
        self.requiresAuth = requiresAuth
    }
}

extension JSONEncoder {
    static var api: JSONEncoder {
        let encoder = JSONEncoder()
        return encoder
    }
}

extension JSONDecoder {
    static var api: JSONDecoder {
        let decoder = JSONDecoder()
        return decoder
    }
}
