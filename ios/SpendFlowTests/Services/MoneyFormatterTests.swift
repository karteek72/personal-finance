import XCTest
@testable import SpendFlow

final class MoneyFormatterTests: XCTestCase {
    func testFormatUSD() {
        XCTAssertEqual(MoneyFormatter.format("127.43"), "$127.43")
    }

    func testFormatNegative() {
        XCTAssertEqual(MoneyFormatter.format("-42.50"), "-$42.50")
    }
}

final class TransactionFiltersTests: XCTestCase {
    func testQueryItemsIncludeSortAndLimit() {
        var filters = TransactionFilters()
        filters.sort = .dateDesc
        filters.limit = 25
        filters.type = .expense

        let names = Set(filters.queryItems().map(\.name))
        XCTAssertTrue(names.contains("sort"))
        XCTAssertTrue(names.contains("limit"))
        XCTAssertTrue(names.contains("type"))
    }
}
