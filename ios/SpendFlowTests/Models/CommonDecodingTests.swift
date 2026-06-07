import XCTest
@testable import SpendFlow

final class CommonDecodingTests: XCTestCase {
    func testPageDecoding() throws {
        let json = """
        {
          "rows": [{"name": "Coffee", "total": "42.00"}],
          "page": 1,
          "pageSize": 25,
          "total": 1,
          "totalPages": 1,
          "sort": "total",
          "dir": "desc",
          "appliedFilters": {}
        }
        """.data(using: .utf8)!

        struct Row: Codable {
            let name: String
            let total: String
        }

        let page = try JSONDecoder.api.decode(Page<Row>.self, from: json)
        XCTAssertEqual(page.rows.count, 1)
        XCTAssertEqual(page.rows[0].name, "Coffee")
        XCTAssertEqual(page.total, 1)
        XCTAssertEqual(page.dir, "desc")
    }

    func testMetricEnvelopeDecoding() throws {
        let json = """
        {
          "value": "1250.00",
          "unit": "USD",
          "grain": "month",
          "asOf": "2026-06-01",
          "class": "descriptive",
          "basis": "factual",
          "confidence": 0.92,
          "caveats": ["Based on linked accounts only"]
        }
        """.data(using: .utf8)!

        let metric = try JSONDecoder.api.decode(MetricEnvelope.self, from: json)
        XCTAssertEqual(metric.value, "1250.00")
        XCTAssertEqual(metric.unit, .USD)
        XCTAssertEqual(metric.confidence, 0.92)
        XCTAssertEqual(metric.caveats?.first, "Based on linked accounts only")
    }

    func testMoneyFlowResponseDecoding() throws {
        let json = """
        {
          "income": {
            "sources": {
              "rows": [{"label": "Payroll", "amount": "5000.00"}],
              "page": 1,
              "pageSize": 25,
              "total": 1,
              "totalPages": 1,
              "sort": "amount",
              "dir": "desc",
              "appliedFilters": {}
            },
            "total": "5000.00"
          },
          "bankAccounts": {
            "accounts": [{"label": "Checking", "amount": "1200.00"}],
            "transfersOut": "0.00"
          },
          "creditCards": {
            "accounts": [],
            "totalCharges": "0.00"
          },
          "monthlySeries": []
        }
        """.data(using: .utf8)!

        let flow = try JSONDecoder.api.decode(MoneyFlowResponse.self, from: json)
        XCTAssertEqual(flow.income.sources.rows.first?.label, "Payroll")
        XCTAssertEqual(flow.income.total, "5000.00")
    }

    func testAccountDecodingWithSnapTradeSource() throws {
        let json = """
        {
          "accounts": [{
            "id": "acc-1",
            "name": "Brokerage",
            "officialName": null,
            "type": "investment",
            "subtype": "brokerage",
            "mask": "1234",
            "balanceCurrent": "10000.00",
            "balanceAvailable": null,
            "currencyCode": "USD",
            "institutionName": "Fidelity",
            "lastSyncedAt": null,
            "status": "active",
            "source": "snaptrade",
            "connectionProvider": "snaptrade",
            "tellerEnrollmentId": null,
            "plaidItemId": null,
            "memberId": null,
            "memberName": null,
            "memberColor": null,
            "liability": null
          }]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.api.decode(AccountsResponse.self, from: json)
        XCTAssertEqual(response.accounts.first?.source, .snaptrade)
    }

    func testAccountDecodingWithLoanTypeAndNumericBalance() throws {
        let json = """
        {
          "accounts": [{
            "id": "acc-loan",
            "name": "Auto Loan",
            "officialName": null,
            "type": "loan",
            "subtype": "auto",
            "mask": "9876",
            "balanceCurrent": 18450.25,
            "balanceAvailable": null,
            "currencyCode": "USD",
            "institutionName": "Bank of America",
            "lastSyncedAt": "2026-06-01T12:00:00.000Z",
            "status": "active",
            "source": "plaid",
            "connectionProvider": "plaid",
            "tellerEnrollmentId": null,
            "plaidItemId": "item-1",
            "memberId": null,
            "memberName": null,
            "memberColor": null,
            "liability": null
          }]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.api.decode(AccountsResponse.self, from: json)
        let account = try XCTUnwrap(response.accounts.first)
        XCTAssertEqual(account.type, .loan)
        XCTAssertEqual(account.balanceCurrent, "18450.25")
    }

    func testAccountDecodingWithCreditLiability() throws {
        let json = """
        {
          "accounts": [{
            "id": "acc-cc",
            "name": "Chase Sapphire",
            "officialName": null,
            "type": "credit",
            "subtype": "credit card",
            "mask": "4521",
            "balanceCurrent": "1845.23",
            "balanceAvailable": "8154.77",
            "currencyCode": "USD",
            "institutionName": "Chase",
            "lastSyncedAt": "2026-06-02T08:15:00.000Z",
            "status": "active",
            "source": "plaid",
            "connectionProvider": "plaid",
            "tellerEnrollmentId": null,
            "plaidItemId": "item-2",
            "memberId": null,
            "memberName": null,
            "memberColor": null,
            "liability": {
              "lastStatementBalance": "1700.00",
              "lastStatementIssueDate": "2026-05-15",
              "minimumPaymentAmount": "35.00",
              "nextPaymentDueDate": "2026-06-20",
              "lastPaymentAmount": "200.00",
              "lastPaymentDate": "2026-05-01",
              "isOverdue": false,
              "aprs": [{
                "aprType": "purchase_apr",
                "aprPercentage": "21.49",
                "balanceSubjectToApr": "1700.00",
                "interestChargeAmount": null
              }],
              "purchaseApr": "21.49",
              "estimatedMonthlyInterest": "30.45",
              "statementVsCurrentDelta": "145.23",
              "daysUntilDue": 14,
              "syncedAt": "2026-06-02T08:15:00.000Z"
            }
          }]
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.api.decode(AccountsResponse.self, from: json)
        let account = try XCTUnwrap(response.accounts.first)
        XCTAssertEqual(account.liability?.purchaseApr, "21.49")
        XCTAssertEqual(account.liability?.daysUntilDue, 14)
    }

    func testInvestmentsResponseDecoding() throws {
        let json = """
        {
          "portfolioValue": "125000.00",
          "totalCostBasis": "100000.00",
          "totalGainLoss": "25000.00",
          "totalGainLossPercent": 25.0,
          "accounts": [],
          "holdings": {
            "rows": [],
            "page": 1,
            "pageSize": 25,
            "total": 0,
            "totalPages": 1,
            "sort": "value",
            "dir": "desc",
            "appliedFilters": {}
          },
          "positions": {
            "rows": [],
            "page": 1,
            "pageSize": 25,
            "total": 0,
            "totalPages": 1,
            "sort": "value",
            "dir": "desc",
            "appliedFilters": {}
          },
          "stockAggregates": [],
          "optionPositions": [],
          "portfolioBreakdown": {
            "stocksValue": "0.00",
            "optionsValue": "0.00",
            "otherValue": "0.00",
            "stocksSharePercent": 0,
            "optionsSharePercent": 0,
            "stockPositionCount": 0,
            "optionPositionCount": 0,
            "totalPositionCount": 0
          },
          "behavioralAlerts": [],
          "investmentHistory": {
            "lookbackYears": 3,
            "totalContributed": "45000.00",
            "currentPortfolioValue": "125000.00",
            "totalCostBasis": "100000.00",
            "unrealizedGain": "25000.00",
            "monthlyAverageInvest": "1250.00",
            "transactionCount": 42,
            "buyTransactionCount": 38
          },
          "monthlyActivity": null
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder.api.decode(InvestmentsResponse.self, from: json)
        XCTAssertEqual(response.investmentHistory?.unrealizedGain, "25000.00")
        XCTAssertEqual(response.investmentHistory?.currentPortfolioValue, "125000.00")
    }
}
