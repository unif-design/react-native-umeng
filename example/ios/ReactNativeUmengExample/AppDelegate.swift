import UIKit
import React
import ReactNativeUmeng

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    true
  }

  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    let umengHandled = UmengBootstrap.shared().handleOpen(url, options: options)
    let reactHandled = RCTLinkingManager.application(
      application,
      open: url,
      options: options
    )
    return umengHandled || reactHandled
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let umengHandled = UmengBootstrap.shared().handleUniversalLink(userActivity)
    let reactHandled = RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
    return umengHandled || reactHandled
  }
}
