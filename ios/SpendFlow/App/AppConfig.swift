import Foundation

enum AppConfig {
    static var apiBaseURL: URL {
        if let urlString = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           !urlString.isEmpty,
           let url = URL(string: urlString) {
            return url
        }
        return URL(string: "https://spendflow-api.stockpulse.win/api/v1")!
    }

    /// Prefers `GoogleService-Info.plist` (from Google Cloud iOS client download), then Info.plist / xcconfig.
    static var googleClientID: String? {
        if let fromGooglePlist = googleServicePlistString(forKey: "CLIENT_ID") {
            return fromGooglePlist
        }
        if let value = Bundle.main.object(forInfoDictionaryKey: "GoogleClientID") as? String,
           !value.isEmpty {
            return value
        }
        return nil
    }

    static var googleReversedClientID: String? {
        if let fromGooglePlist = googleServicePlistString(forKey: "REVERSED_CLIENT_ID") {
            return fromGooglePlist
        }
        return nil
    }

    static var isGoogleSignInConfigured: Bool {
        googleClientID != nil
    }

    private static func googleServicePlistString(forKey key: String) -> String? {
        guard let url = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
              let value = plist[key] as? String,
              !value.isEmpty else {
            return nil
        }
        return value
    }
}
