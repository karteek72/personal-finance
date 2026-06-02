import Foundation

enum MoneyFormatter {
    private static let currencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    static func format(_ amount: String, currencyCode: String = "USD") -> String {
        guard let decimal = Decimal(string: amount.trimmingCharacters(in: .whitespaces)) else {
            return amount
        }
        currencyFormatter.currencyCode = currencyCode
        return currencyFormatter.string(from: decimal as NSDecimalNumber) ?? amount
    }

    static func isNonNegative(_ amount: String) -> Bool {
        guard let decimal = Decimal(string: amount) else { return true }
        return decimal >= 0
    }
}
