import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

private func require(_ value: @autoclosure () -> Bool, _ message: String) {
  guard value() else { fatalError(message) }
}

@_cdecl("umeng_native_tests")
public func runTests() {
  let app = AppDelegate()
  require(app.application(UIApplication()), "launch with default options succeeds")
  require(app.application(UIApplication(), didFinishLaunchingWithOptions: [UIApplication.LaunchOptionsKey(): "value"]), "launch with options succeeds")
  let subject = SceneDelegate()
  let options = UIScene.ConnectionOptions()
  let session = UISceneSession()
  subject.scene(UIScene(), willConnectTo: session, options: options)
  require(subject.window == nil && subject.reactNativeFactory == nil && subject.dependencyProvider == nil,
          "non-window scenes do not initialize React Native")
  let scene = UIWindowScene()
  subject.scene(scene, willConnectTo: session, options: options)
  require(subject.window?.windowScene === scene, "window belongs to supplied scene")
  require(subject.dependencyProvider is RCTAppDependencyProvider, "RN dependency provider is installed")
  require(subject.reactNativeFactory?.delegate === subject, "factory retains actual scene delegate")
  let starts = Boundary.events.filter { $0.0 == "react.start" }
  require(starts.count == 1, "only the window scene starts RN")
  require(starts[0].1["name"] as? String == "ReactNativeUmengExample", "JS module name is retained")
  require(starts[0].1["window"] as? UIWindow === subject.window, "RN starts in the actual window")
  require(starts[0].1["options"] as? UIScene.ConnectionOptions === options, "connection options retain identity")
  #if DEBUG
  require(subject.reactNativeFactory?.devMenuConfiguration?.devMenuEnabled == true, "debug dev menu is enabled")
  require(subject.reactNativeFactory?.devMenuConfiguration?.shakeGestureEnabled == true, "debug shake is enabled")
  require(subject.reactNativeFactory?.devMenuConfiguration?.keyboardShortcutsEnabled == true, "debug shortcuts are enabled")
  require(subject.bundleURL() == Boundary.bundle, "debug bundle uses Metro URL")
  Boundary.bundle = nil
  require(subject.bundleURL() == nil, "missing Metro URL is forwarded")
  require(Boundary.events.filter { $0.0 == "metro.bundle" }.allSatisfy { $0.1["root"] as? String == "index" }, "Metro uses index entry")
  #else
  require(subject.reactNativeFactory?.devMenuConfiguration == nil, "release leaves debug menu unset")
  require(subject.bundleURL() == Bundle.main.url(forResource: "main", withExtension: "jsbundle"), "release reads actual bundle resource")
  #endif
  for contexts in [Set<UIOpenURLContext>(), Set([UIOpenURLContext(url: URL(string: "umeng://example")!)])] {
    subject.scene(scene, openURLContexts: contexts)
    let last = Boundary.events.last!
    require(last.0 == "react.urls", "URL event is delivered")
    require(last.1["scene"] as? UIScene === scene, "URL scene identity is retained")
    require(last.1["contexts"] as? Set<UIOpenURLContext> == contexts, "all URL contexts are retained")
  }
  let activity = NSUserActivity(activityType: "NSUserActivityTypeBrowsingWeb")
  subject.scene(scene, continue: activity)
  require(Boundary.events.last!.0 == "react.activity", "universal link is delivered")
  require(Boundary.events.last!.1["activity"] as? NSUserActivity === activity, "activity identity is retained")
  require(Boundary.events.last!.1["scene"] as? UIScene === scene, "activity scene identity is retained")
  let fullOptions = UISceneOpenURLOptions()
  fullOptions.openInPlace = true
  fullOptions.sourceApplication = "com.unif.callback"
  let annotation = NSObject()
  let attribution = NSObject()
  fullOptions.annotation = annotation
  fullOptions.eventAttribution = attribution
  let richContext = UIOpenURLContext(url: URL(string: "umeng://full")!, options: fullOptions)
  let plainContext = UIOpenURLContext(url: URL(string: "umeng://plain")!)
  let contexts = Set([richContext, plainContext])
  let coldOptions = UIScene.ConnectionOptions()
  coldOptions.urlContexts = contexts
  coldOptions.userActivities = [activity, NSUserActivity(activityType: "second")]
  Boundary.events = []
  subject.scene(scene, willConnectTo: session, options: coldOptions)
  let vendorEvents = Boundary.events.filter { $0.0.hasPrefix("vendor.") }
  require(vendorEvents.count == 4, "all cold callbacks reach vendor")
  let startIndex = Boundary.events.firstIndex { $0.0 == "react.start" }!
  require(Boundary.events[..<startIndex].filter { $0.0.hasPrefix("vendor.") }.count == 4,
          "vendor callbacks precede React cold start")
  require(!Boundary.events.contains { $0.0.hasPrefix("react.application.") },
          "RN receives initial links exactly through connectionOptions")
  require(Boundary.events[startIndex].1["options"] as? UIScene.ConnectionOptions === coldOptions,
          "all cold connection options retain identity")
  func checkOptions() {
    let forwarded = Boundary.events.filter { $0.0 == "vendor.url" }
    for context in contexts {
      let event = forwarded.first { $0.1["url"] as? URL == context.url }!
      let values = event.1["options"] as! [UIApplication.OpenURLOptionsKey: Any]
      require(values[.openInPlace] as? Bool == context.options.openInPlace, "openInPlace retains value")
      if context === richContext {
        require(values.count == 4, "all rich callback keys are retained")
        require(values[.sourceApplication] as? String == fullOptions.sourceApplication, "source app is retained")
        require(values[.annotation] as? NSObject === annotation, "annotation identity is retained")
        require(values[.eventAttribution] as? NSObject === attribution, "attribution identity is retained")
      } else {
        require(values.count == 1, "absent optional keys remain absent")
      }
    }
  }
  checkOptions()
  Boundary.events = []
  subject.scene(scene, openURLContexts: contexts)
  checkOptions()
  require(Boundary.events.last!.0 == "react.urls", "vendor warm URLs precede RN scene callback")

  let fixture = SceneDelegateFixture()
  fixture.scene(scene, openURLContexts: [])
  fixture.scene(scene, willConnectTo: session, options: UIScene.ConnectionOptions())
  for vendor in [false, true] {
    for react in [false, true] {
      Boundary.vendorHandled = vendor
      Boundary.reactHandled = react
      Boundary.events = []
      let callbackOptions: [UIApplication.OpenURLOptionsKey: Any] = [.sourceApplication: "legacy"]
      require(app.application(UIApplication.shared, open: plainContext.url, options: callbackOptions) == (vendor || react),
              "legacy URL aggregate result follows both handlers")
      require(Boundary.events.map { $0.0 } == ["vendor.url", "react.application.url"],
              "both URL handlers execute even when vendor handles callback")
      require(Boundary.events.last!.1["application"] as? UIApplication === UIApplication.shared, "application identity retained")
      require((Boundary.events.last!.1["options"] as? [UIApplication.OpenURLOptionsKey: Any])?[.sourceApplication] as? String == "legacy", "legacy options retained")
      Boundary.events = []
      var restored = false
      require(app.application(UIApplication.shared, continue: activity, restorationHandler: { value in
        restored = true
        require(value == nil, "restoration payload forwarded")
      }) == (vendor || react), "legacy activity aggregate result follows both handlers")
      require(restored, "restoration handler passed to RN")
      require(Boundary.events.map { $0.0 } == ["vendor.activity", "react.application.activity"], "both activity handlers execute")
      Boundary.events = []
      fixture.scene(scene, openURLContexts: contexts)
      checkOptions()
      require(Boundary.events.filter { $0.0 == "react.application.url" }.count == 2, "legacy fixture forwards every URL to RN")
      fixture.scene(scene, continue: activity)
      require(Boundary.events.last!.0 == "react.application.activity", "legacy fixture forwards activity to RN")
      Boundary.events = []
      fixture.scene(scene, willConnectTo: session, options: coldOptions)
      checkOptions()
      require(Boundary.events.filter { $0.0 == "react.application.url" }.count == 2, "fixture cold URLs forwarded")
      require(Boundary.events.filter { $0.0 == "react.application.activity" }.count == 2, "fixture cold activities forwarded")
    }
  }
  print("Umeng iOS host assertions passed")
}
