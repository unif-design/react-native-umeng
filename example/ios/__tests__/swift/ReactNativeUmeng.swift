// The example consumes this library as an external host boundary. Its complete
// native implementation is measured separately by scripts/test-native-ios.sh.
import UIKit

public final class UmengBootstrap {
  private static let instance = UmengBootstrap()
  public static func shared() -> UmengBootstrap { instance }
  public func handleOpen(_ url: URL, options: [UIApplication.OpenURLOptionsKey: Any]) -> Bool {
    Boundary.record("vendor.url", ["url": url, "options": options])
    return Boundary.vendorHandled
  }
  public func handleUniversalLink(_ activity: NSUserActivity) -> Bool {
    Boundary.record("vendor.activity", ["activity": activity])
    return Boundary.vendorHandled
  }
}
