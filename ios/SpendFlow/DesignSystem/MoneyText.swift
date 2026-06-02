import SwiftUI

struct MoneyText: View {
    let amount: String
    var currencyCode: String = "USD"
    var font: Font = .body.monospacedDigit().weight(.semibold)

    var body: some View {
        Text(MoneyFormatter.format(amount, currencyCode: currencyCode))
            .font(font)
            .monospacedDigit()
    }
}
