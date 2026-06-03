import Foundation

struct Alert: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let severity: AlertSeverity
    let title: String
    let message: String
    let dismissible: Bool
}

enum AlertSeverity: String, Codable, Sendable {
    case info
    case warning
    case danger
}

struct AlertsResponse: Codable, Sendable {
    let alerts: [Alert]
}
