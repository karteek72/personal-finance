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
}
