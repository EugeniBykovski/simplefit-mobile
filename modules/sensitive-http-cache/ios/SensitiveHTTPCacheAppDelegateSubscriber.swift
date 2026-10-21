import Expo
import ExpoModulesCore

/**
 Applies `SensitiveHTTPCache` at launch (SF-70 D1). `willFinishLaunching`
 runs before React Native starts, so before any `fetch` creates the
 `expo/fetch` session and before the session is restored. The two log lines
 carry no content; they show on a device that the provider is used and what
 the purge did.
 */
public final class SensitiveHTTPCacheAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    ExpoFetchCustomExtension.setCustomURLSessionConfigurationProvider {
      log.info("SF-70 sensitive-http-cache: expo/fetch session without HTTP cache")
      return SensitiveHTTPCache.apiSessionConfiguration()
    }
    let purge = SensitiveHTTPCache.purgeIfNeeded()
    log.info("SF-70 sensitive-http-cache: purge \(purge)")
    if purge == .failed {
      log.warn("SF-70 sensitive-http-cache: the purge did not complete; retrying on next launch")
    }
    return true
  }
}
