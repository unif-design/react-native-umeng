import React
import ReactNativeUmeng
import UIKit

// 只做 Scene lifecycle 编译夹具；example 没有注册 scene manifest。
final class SceneDelegateFixture: UIResponder, UIWindowSceneDelegate {
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      let options = applicationOptions(for: context)
      let umengHandled = UmengBootstrap.shared().handleOpen(context.url, options: options)
      let reactHandled = RCTLinkingManager.application(
        UIApplication.shared,
        open: context.url,
        options: options
      )
      _ = umengHandled || reactHandled
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    let umengHandled = UmengBootstrap.shared().handleUniversalLink(userActivity)
    let reactHandled = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
    _ = umengHandled || reactHandled
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    for context in connectionOptions.urlContexts {
      let options = applicationOptions(for: context)
      let umengHandled = UmengBootstrap.shared().handleOpen(context.url, options: options)
      let reactHandled = RCTLinkingManager.application(
        UIApplication.shared,
        open: context.url,
        options: options
      )
      _ = umengHandled || reactHandled
    }

    for userActivity in connectionOptions.userActivities {
      let umengHandled = UmengBootstrap.shared().handleUniversalLink(userActivity)
      let reactHandled = RCTLinkingManager.application(
        UIApplication.shared,
        continue: userActivity,
        restorationHandler: { _ in }
      )
      _ = umengHandled || reactHandled
    }
  }

  private func applicationOptions(
    for context: UIOpenURLContext
  ) -> [UIApplication.OpenURLOptionsKey: Any] {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: context.options.openInPlace
    ]
    if let sourceApplication = context.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }
    if let annotation = context.options.annotation {
      options[.annotation] = annotation
    }
    if let eventAttribution = context.options.eventAttribution {
      options[.eventAttribution] = eventAttribution
    }
    return options
  }
}
