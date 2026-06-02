import Foundation

enum AppConfig {
    /// Backend REST base URL (no trailing slash).
    static var apiBaseURL: URL {
        if let urlString = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
           !urlString.isEmpty,
           let url = URL(string: urlString) {
            return url
        }
        return URL(string: "https://spendflow-api.stockpulse.win/api/v1")!
    }

    /// iOS OAuth client — native Google Sign-In and URL scheme redirect.
    static var googleClientID: String? {
        if let fromGooglePlist = googleServicePlistString(forKey: "CLIENT_ID") {
            return fromGooglePlist
        }
        return infoPlistString(forKey: "GoogleClientID")
    }

    /// Web OAuth client — must match backend `GOOGLE_CLIENT_ID` (ID token audience).
    static var googleServerClientID: String? {
        infoPlistString(forKey: "GoogleServerClientID")
    }

    static var googleReversedClientID: String? {
        googleServicePlistString(forKey: "REVERSED_CLIENT_ID")
    }

    static var isGoogleSignInConfigured: Bool {
        googleClientID != nil && googleServerClientID != nil
    }

    private static func infoPlistString(forKey key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty else {
            return nil
        }
        return value
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
