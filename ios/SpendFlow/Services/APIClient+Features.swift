import Foundation

extension APIClient {
    // MARK: - Wealth

    func getNetWorth() async throws -> NetWorthResponse {
        try await send(APIRequest(path: "/wealth/net-worth"))
    }

    func getInvestments(
        accountId: String? = nil,
        kind: PositionKindFilter? = nil,
        query: ListQuery = ListQuery()
    ) async throws -> InvestmentsResponse {
        var items = query.queryItems()
        if let accountId { items.append(.init(name: "accountId", value: accountId)) }
        if let kind { items.append(.init(name: "kind", value: kind.rawValue)) }
        return try await send(APIRequest(path: "/wealth/investments", queryItems: items))
    }

    func getFire(overrides: FireQueryOverrides = FireQueryOverrides()) async throws -> FireResponse {
        var items: [URLQueryItem] = []
        if let monthlySpend = overrides.monthlySpend {
            items.append(.init(name: "monthlySpend", value: String(monthlySpend)))
        }
        if let monthlyInvest = overrides.monthlyInvest {
            items.append(.init(name: "monthlyInvest", value: String(monthlyInvest)))
        }
        if let withdrawalRate = overrides.withdrawalRate {
            items.append(.init(name: "withdrawalRate", value: String(withdrawalRate)))
        }
        if let realReturn = overrides.realReturn {
            items.append(.init(name: "realReturn", value: String(realReturn)))
        }
        return try await send(APIRequest(path: "/wealth/fire", queryItems: items))
    }

    func patchFire(_ patch: FireProfilePatch) async throws -> FireResponse {
        let body = try JSONEncoder.api.encode(patch)
        return try await send(APIRequest(path: "/wealth/fire", method: .patch, body: body))
    }

    func getCreditDebtSummary() async throws -> CreditDebtSummary {
        try await send(APIRequest(path: "/liabilities/summary"))
    }

    // MARK: - Insights

    func getWellness() async throws -> WellnessResponse {
        try await send(APIRequest(path: "/insights/wellness"))
    }

    func getDna() async throws -> DnaResponse {
        try await send(APIRequest(path: "/insights/dna"))
    }

    func getPatterns(query: ListQuery = ListQuery()) async throws -> PatternsResponse {
        try await send(APIRequest(path: "/insights/patterns", queryItems: query.queryItems()))
    }

    func getBehavioral() async throws -> BehavioralResponse {
        try await send(APIRequest(path: "/insights/behavioral"))
    }

    func getMerchants() async throws -> MerchantsResponse {
        try await send(APIRequest(path: "/insights/merchants"))
    }

    func getMerchantsTable(query: ListQuery = ListQuery()) async throws -> MerchantsTableResponse {
        try await send(APIRequest(path: "/analytics/merchants", queryItems: query.queryItems()))
    }

    func setTransactionReason(transactionId: String, reasonId: String) async throws -> TransactionReasonResponse {
        let body = try JSONEncoder.api.encode(["reasonId": reasonId])
        return try await send(
            APIRequest(path: "/transactions/\(transactionId)/reason", method: .put, body: body)
        )
    }

    func clearTransactionReason(transactionId: String) async throws -> TransactionReasonResponse {
        try await send(APIRequest(path: "/transactions/\(transactionId)/reason", method: .delete))
    }

    func getWrapped() async throws -> WrappedResponse {
        try await send(APIRequest(path: "/wrapped"))
    }

    // MARK: - Planning

    func getBudgets() async throws -> BudgetsResponse {
        try await send(APIRequest(path: "/planning/budgets"))
    }

    func upsertBudget(_ input: UpsertBudgetInput) async throws -> BudgetRow {
        let body = try JSONEncoder.api.encode(input)
        return try await send(APIRequest(path: "/planning/budgets", method: .post, body: body))
    }

    func patchBudget(budgetId: String, patch: PatchBudgetInput) async throws -> BudgetRow {
        let body = try JSONEncoder.api.encode(patch)
        return try await send(
            APIRequest(path: "/planning/budgets/\(budgetId)", method: .patch, body: body)
        )
    }

    func deleteBudget(budgetId: String) async throws -> DeleteIdResponse {
        try await send(APIRequest(path: "/planning/budgets/\(budgetId)", method: .delete))
    }

    func createGoal(_ input: CreateGoalInput) async throws -> GoalRow {
        let body = try JSONEncoder.api.encode(input)
        return try await send(APIRequest(path: "/planning/goals", method: .post, body: body))
    }

    func patchGoal(goalId: String, patch: PatchGoalInput) async throws -> GoalRow {
        let body = try JSONEncoder.api.encode(patch)
        return try await send(
            APIRequest(path: "/planning/goals/\(goalId)", method: .patch, body: body)
        )
    }

    func deleteGoal(goalId: String) async throws -> DeleteIdResponse {
        try await send(APIRequest(path: "/planning/goals/\(goalId)", method: .delete))
    }

    func getRecurring(query: ListQuery = ListQuery()) async throws -> RecurringResponse {
        try await send(APIRequest(path: "/planning/recurring", queryItems: query.queryItems()))
    }

    func getCalendar() async throws -> CalendarResponse {
        try await send(APIRequest(path: "/planning/calendar"))
    }

    func getForecast() async throws -> ForecastResponse {
        try await send(APIRequest(path: "/planning/forecast"))
    }

    // MARK: - Protect

    func getInflation(query: ListQuery = ListQuery()) async throws -> InflationResponse {
        try await send(APIRequest(path: "/protect/inflation", queryItems: query.queryItems()))
    }

    func getResilience() async throws -> ResilienceResponse {
        try await send(APIRequest(path: "/protect/resilience"))
    }

    // MARK: - Household (read)

    func getHousehold() async throws -> HouseholdResponse {
        try await send(APIRequest(path: "/household"))
    }

    func getHouseholdInsights(from: String? = nil, to: String? = nil) async throws -> HouseholdInsightsResponse {
        var queryItems: [URLQueryItem] = []
        if let from { queryItems.append(.init(name: "from", value: from)) }
        if let to { queryItems.append(.init(name: "to", value: to)) }
        return try await send(
            APIRequest(path: "/household/insights", queryItems: queryItems)
        )
    }

    // MARK: - Profile

    func getUserProfile() async throws -> UserProfileResponse {
        try await send(APIRequest(path: "/user/profile"))
    }

    func patchUserProfile(_ patch: UserProfilePatch) async throws -> UserProfileResponse {
        let body = try JSONEncoder.api.encode(patch)
        return try await send(APIRequest(path: "/user/profile", method: .patch, body: body))
    }

    func getAnalyticsProfile() async throws -> AnalyticsProfileResponse {
        try await send(APIRequest(path: "/user/analytics-profile"))
    }

    func patchAnalyticsProfile(_ patch: FireProfilePatch) async throws -> AnalyticsProfileResponse {
        let body = try JSONEncoder.api.encode(patch)
        return try await send(
            APIRequest(path: "/user/analytics-profile", method: .patch, body: body)
        )
    }

    // MARK: - Coach & analytics

    func getCoach() async throws -> CoachResponse {
        try await send(APIRequest(path: "/coach/insights"))
    }

    func askCoach(question: String) async throws -> CoachAskResponse {
        let body = try JSONEncoder.api.encode(["question": question])
        return try await send(APIRequest(path: "/coach/ask", method: .post, body: body))
    }

    func recomputeAnalytics() async throws -> RecomputeAnalyticsResponse {
        try await send(APIRequest(path: "/analytics/recompute", method: .post))
    }
}

struct DeleteIdResponse: Codable, Sendable {
    let id: String
}
