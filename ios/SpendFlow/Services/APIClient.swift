import Foundation

final class APIClient: Sendable {
    let baseURL: URL
    let authService: AuthService?
    let urlSession: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL, authService: AuthService?) {
        self.baseURL = baseURL
        self.authService = authService
        self.urlSession = URLSession(configuration: .default)
    }

    // MARK: - Auth

    func signInWithGoogle(idToken: String) async throws -> AuthSessionResponse {
        let body = try JSONEncoder.api.encode(["idToken": idToken])
        return try await send(
            APIRequest(
                path: "/auth/google",
                method: .post,
                body: body,
                requiresAuth: false
            ),
            retryOnUnauthorized: false
        )
    }

    func refreshSession(refreshToken: String) async throws -> AuthRefreshResponse {
        let body = try JSONEncoder.api.encode(["refreshToken": refreshToken])
        return try await send(
            APIRequest(
                path: "/auth/refresh",
                method: .post,
                body: body,
                requiresAuth: false
            ),
            retryOnUnauthorized: false
        )
    }

    func signOut(accessToken: String) async throws {
        let (_, response) = try await rawSend(
            APIRequest(path: "/auth/logout", method: .post),
            accessToken: accessToken
        )
        guard response.statusCode == 204 || (200 ... 299).contains(response.statusCode) else {
            throw APIError.httpStatus(response.statusCode, message: "Sign out failed")
        }
    }

    func getMe() async throws -> AuthMeResponse {
        try await send(APIRequest(path: "/auth/me"))
    }

    func registerDeviceToken(_ token: String) async throws {
        struct Body: Encodable { let token: String; let platform: String }
        struct Response: Decodable { let ok: Bool }
        let body = try JSONEncoder.api.encode(Body(token: token, platform: "ios"))
        let _: Response = try await send(
            APIRequest(path: "/devices/register", method: .post, body: body)
        )
    }

    // MARK: - Transactions & insights

    func getSummary(from: String? = nil, to: String? = nil) async throws -> TransactionSummary {
        var query: [URLQueryItem] = []
        if let from { query.append(.init(name: "from", value: from)) }
        if let to { query.append(.init(name: "to", value: to)) }
        return try await send(APIRequest(path: "/transactions/summary", queryItems: query))
    }

    func getTransactions(filters: TransactionFilters = TransactionFilters()) async throws -> PaginatedTransactions {
        try await send(APIRequest(path: "/transactions", queryItems: filters.queryItems()))
    }

    func getCategories(from: String? = nil, to: String? = nil) async throws -> CategoriesResponse {
        var query: [URLQueryItem] = []
        if let from { query.append(.init(name: "from", value: from)) }
        if let to { query.append(.init(name: "to", value: to)) }
        return try await send(APIRequest(path: "/transactions/by-category", queryItems: query))
    }

    func getMoneyFlow(from: String? = nil, to: String? = nil) async throws -> MoneyFlowResponse {
        var query: [URLQueryItem] = []
        if let from { query.append(.init(name: "from", value: from)) }
        if let to { query.append(.init(name: "to", value: to)) }
        return try await send(APIRequest(path: "/transactions/flow", queryItems: query))
    }

    func getAlerts(month: String? = nil) async throws -> AlertsResponse {
        var query: [URLQueryItem] = []
        if let month { query.append(.init(name: "month", value: month)) }
        return try await send(APIRequest(path: "/insights/alerts", queryItems: query))
    }

    func getTrends(from: String? = nil, to: String? = nil) async throws -> TrendsResponse {
        var query: [URLQueryItem] = []
        if let from { query.append(.init(name: "from", value: from)) }
        if let to { query.append(.init(name: "to", value: to)) }
        return try await send(APIRequest(path: "/insights/trends", queryItems: query))
    }

    // MARK: - Accounts & Plaid

    func getAccounts() async throws -> AccountsResponse {
        try await send(APIRequest(path: "/accounts"))
    }

    func deleteAccount(accountId: String) async throws -> DeleteAccountResponse {
        try await send(APIRequest(path: "/accounts/\(accountId)", method: .delete))
    }

    func syncAccount(accountId: String) async throws -> PlaidSyncResponse {
        try await send(APIRequest(path: "/accounts/\(accountId)/sync", method: .post))
    }

    func createPlaidLinkToken(platform: String = "ios") async throws -> PlaidLinkTokenResponse {
        let body = try JSONEncoder.api.encode(["platform": platform])
        return try await send(
            APIRequest(path: "/plaid/link-token", method: .post, body: body)
        )
    }

    func exchangePlaidToken(publicToken: String) async throws -> PlaidExchangeResponse {
        let body = try JSONEncoder.api.encode(["publicToken": publicToken])
        return try await send(
            APIRequest(path: "/plaid/exchange-token", method: .post, body: body)
        )
    }

    // MARK: - Transport

    func send<T: Decodable>(
        _ request: APIRequest,
        retryOnUnauthorized: Bool = true
    ) async throws -> T {
        let token = await MainActor.run {
            request.requiresAuth ? authService?.accessToken : nil
        }

        let (data, response) = try await rawSend(request, accessToken: token)

        if response.statusCode == 401, retryOnUnauthorized, request.requiresAuth {
            try await MainActor.run {
                guard authService != nil else {
                    throw APIError.unauthenticated
                }
            }
            try await authService?.refreshAccessToken()
            return try await send(request, retryOnUnauthorized: false)
        }

        return try decodeSuccess(data: data, response: response)
    }

    func rawSend(
        _ request: APIRequest,
        accessToken: String?
    ) async throws -> (Data, HTTPURLResponse) {
        let trimmedPath = request.path.hasPrefix("/")
            ? String(request.path.dropFirst())
            : request.path
        guard var components = URLComponents(
            url: baseURL.appending(path: trimmedPath),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }

        if !request.queryItems.isEmpty {
            components.queryItems = request.queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body = request.body {
            urlRequest.httpBody = body
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if let accessToken {
            urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await urlSession.data(for: urlRequest)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.transport(URLError(.badServerResponse))
            }
            return (data, http)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error)
        }
    }

    func decodeSuccess<T: Decodable>(data: Data, response: HTTPURLResponse) throws -> T {
        if response.statusCode == 204 {
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
            throw APIError.httpStatus(204, message: "No content")
        }

        guard (200 ... 299).contains(response.statusCode) else {
            if let apiError = try? JSONDecoder.api.decode(APIErrorResponse.self, from: data) {
                throw APIError.httpStatus(response.statusCode, message: apiError.error.message)
            }
            throw APIError.httpStatus(response.statusCode, message: "")
        }

        do {
            return try JSONDecoder.api.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

struct EmptyResponse: Decodable, Sendable {}

extension APIClient {
    static func makeAuthenticated(authService: AuthService) -> APIClient {
        APIClient(authService: authService)
    }
}
