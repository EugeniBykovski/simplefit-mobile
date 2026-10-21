import Foundation

/**
 Keeps API responses out of the iOS HTTP disk cache (SF-70 D1).

 `fetch` is `expo/fetch`, whose `URLSession` uses `URLSessionConfiguration.default`
 and so `URLCache.shared`, stored in `Library/Caches/<bundle id>/Cache.db`.
 That cache keeps `private` responses (the viewer, profiles; before the API
 marked them `no-store`, the refresh response with the access and refresh
 tokens), and in debug dev-client builds the network inspector's
 `URLProtocol` stores every response, `no-store` included. The refresh token
 then lived outside the Keychain.

 Plain Foundation, so the same file runs in a native probe without the app.
 */
public enum SensitiveHTTPCache {
  /// Bump to purge again on the next launch after an upgrade.
  public static let purgeVersion = 1
  public static let purgeVersionKey = "SimpleFitSensitiveHTTPCachePurgeVersion"

  /**
   The `expo/fetch` session configuration: Expo's own settings
   (`ExpoFetchModule.createURLSession`: the shared cookie store,
   `ReactNetworkForceWifiOnly`) with a cache that holds nothing, so no
   response is written to or read from disk. Images and other native loaders
   keep their own caches.

   Based on `.ephemeral`, not `.default`: in debug dev-client builds the
   network inspector swizzles `.default` to add a `URLProtocol` that reports
   every response as storable, and under it the shared cache still received
   API responses whatever this session's own cache was (SF-70 native probe).
   So the inspector does not show `fetch` traffic; release builds have no
   inspector.
   */
  public static func apiSessionConfiguration(
    infoDictionary: [String: Any]? = Bundle.main.infoDictionary
  ) -> URLSessionConfiguration {
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = true
    config.httpCookieAcceptPolicy = .always
    config.httpCookieStorage = HTTPCookieStorage.shared
    if infoDictionary?["ReactNetworkForceWifiOnly"] as? Bool ?? false {
      config.allowsCellularAccess = false
    }
    config.urlCache = URLCache(memoryCapacity: 0, diskCapacity: 0, directory: nil)
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    return config
  }

  public enum PurgeResult: Equatable {
    case alreadyDone
    case purged
    /// Something is still on disk; the marker is not written, so the next launch tries again.
    case failed
  }

  /**
   Once per `purgeVersion`: removes the responses an earlier build cached.
   Runs before React Native starts, so before the session is restored. Only
   the HTTP cache is touched: never the Keychain, user defaults other than
   the marker, or any other file. `URLCache` cannot remove one origin's
   entries, so the whole HTTP cache goes (re-downloadable responses only).

   `removeAllCachedResponses()` reports no failure and the store's file
   keeps its size, so a sentinel entry proves the removal: it is stored
   first and must be gone afterwards. Only then is the marker written; an
   interrupted or failed purge runs again on the next launch.
   */
  public static func purgeIfNeeded(
    defaults: UserDefaults = .standard,
    cache: URLCache = .shared
  ) -> PurgeResult {
    if defaults.integer(forKey: purgeVersionKey) >= purgeVersion {
      return .alreadyDone
    }
    let sentinel = URLRequest(url: URL(string: "https://purge-sentinel.simplefit.invalid/")!)
    if let response = HTTPURLResponse(
      url: sentinel.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: nil
    ) {
      cache.storeCachedResponse(CachedURLResponse(response: response, data: Data()), for: sentinel)
    }
    cache.removeAllCachedResponses()
    guard cache.cachedResponse(for: sentinel) == nil else {
      return .failed
    }
    defaults.set(purgeVersion, forKey: purgeVersionKey)
    return .purged
  }
}
