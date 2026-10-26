@_exported import Foundation

@_silgen_name("umeng_native_tests") private func runUmengNativeTests()

open class UIResponder: NSObject {}
public protocol UIApplicationDelegate {}
extension UIApplicationDelegate {
  // Replace UIApplicationMain at the external boundary, preserving @main.
  public static func main() { runUmengNativeTests() }
}
open class UIApplication: NSObject {
  public static let shared = UIApplication()
  public struct LaunchOptionsKey: Hashable { public init() {} }
  public struct OpenURLOptionsKey: Hashable {
    private let value: String
    private init(_ value: String) { self.value = value }
    public static let openInPlace = Self("openInPlace")
    public static let sourceApplication = Self("sourceApplication")
    public static let annotation = Self("annotation")
    public static let eventAttribution = Self("eventAttribution")
  }
}
public protocol UIUserActivityRestoring {}
open class UIScene: NSObject {
  public final class ConnectionOptions: NSObject {
    public var urlContexts: Set<UIOpenURLContext> = []
    public var userActivities: Set<NSUserActivity> = []
  }
}
open class UIWindowScene: UIScene {}
open class UISceneSession: NSObject {}
public protocol UIWindowSceneDelegate {}
open class UIWindow: NSObject {
  public let windowScene: UIWindowScene
  public init(windowScene: UIWindowScene) { self.windowScene = windowScene }
}
open class UIOpenURLContext: NSObject {
  public let url: URL
  public let options: UISceneOpenURLOptions
  public init(url: URL, options: UISceneOpenURLOptions = UISceneOpenURLOptions()) {
    self.url = url
    self.options = options
  }
}
open class UISceneOpenURLOptions: NSObject {
  public var openInPlace = false
  public var sourceApplication: String?
  public var annotation: Any?
  public var eventAttribution: Any?
}
public enum Boundary {
  public static var events: [(String, [String: Any])] = []
  public static var bundle: URL? = URL(string: "http://localhost:8081/index.bundle")
  public static var reactHandled = false
  public static var vendorHandled = false
  public static func record(_ name: String, _ values: [String: Any] = [:]) {
    events.append((name, values))
  }
}
