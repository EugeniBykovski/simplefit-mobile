import Expo
import ExpoModulesCore

/**
 Applies `SensitiveHTTPCache` at launch (SF-70 D1). `willFinishLaunching`
 runs before React Native starts, so before any `fetch` creates the
 `expo/fetch` session and before the session is restored.
 */
public final class SensitiveHTTPCacheAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    ExpoFetchCustomExtension.setCustomURLSessionConfigurationProvider {
      SensitiveHTTPCache.apiSessionConfiguration()
    }
    if SensitiveHTTPCache.purgeIfNeeded() == .failed {
      // Never logged with content; the next launch tries again.
      log.warn("SF-70: the HTTP cache purge did not complete; retrying on next launch")
    }
    return true
  }
}
