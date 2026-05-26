import Foundation
import UIKit
import UMCommon
import UMShare

/// Umeng iOS 初始化共享单例。
///
/// 友盟 iOS 公开 SDK 没有 preInit。PIPL 解法：用户同意《隐私协议》前完全不调任何友盟 API。
/// `ensureInit()` 由 `UmengCommonImpl.init()` 触发，读 Info.plist 配置，跑
/// UMConfigure.initWithAppkey + setPlaform（拼写遵循 SDK 原始错误，少一个 t）。
@objcMembers
public final class UmengBootstrap: NSObject {
  public static let shared = UmengBootstrap()
  private let lock = NSLock()
  private var inited = false

  private override init() { super.init() }

  public func ensureInit() throws {
    lock.lock()
    defer { lock.unlock() }
    if inited { return }
    let cfg = try readConfig()
    UMConfigure.initWithAppkey(cfg.appkey, channel: cfg.channel)
    if let wxId = cfg.wechatAppid, let wxSecret = cfg.wechatSecret {
      UMSocialManager.default()?.setPlaform(
        .wechatSession,
        appKey: wxId,
        appSecret: wxSecret,
        redirectURL: nil
      )
      if let ul = cfg.wechatUniversalLink {
        UMSocialGlobal.shareInstance().universalLinkDic = [
          NSNumber(value: UMSocialPlatformType.wechatSession.rawValue): ul
        ]
      }
    }
    if let ddId = cfg.dingtalkAppid {
      UMSocialManager.default()?.setPlaform(
        .dingDing,
        appKey: ddId,
        appSecret: nil,
        redirectURL: nil
      )
    }
    inited = true
  }

  public func isInited() -> Bool {
    lock.lock(); defer { lock.unlock() }
    return inited
  }

  /// 由宿主 App 的 application(_:open:options:) 调
  public func handleOpen(_ url: URL, options: [UIApplication.OpenURLOptionsKey: Any]) -> Bool {
    return UMSocialManager.default()?.handleOpen(url, options: options) ?? false
  }

  /// 由宿主 App 的 continueUserActivity:restorationHandler: 调（微信 UL 必需）
  public func handleUniversalLink(_ userActivity: NSUserActivity) -> Bool {
    return UMSocialManager.default()?.handleUniversalLink(userActivity, options: nil) ?? false
  }

  // ── private ──────────────────────────────────────────────

  private struct Config {
    let appkey: String
    let channel: String
    let wechatAppid: String?
    let wechatSecret: String?
    let wechatUniversalLink: String?
    let dingtalkAppid: String?
  }

  private func readConfig() throws -> Config {
    guard let info = Bundle.main.infoDictionary else {
      throw NSError(domain: "UmengBootstrap", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Info.plist not available"
      ])
    }
    guard let appkey = info["UMENG_APPKEY"] as? String, !appkey.isEmpty else {
      throw NSError(domain: "UmengBootstrap", code: -2, userInfo: [
        NSLocalizedDescriptionKey: "Info.plist key UMENG_APPKEY is required"
      ])
    }
    return Config(
      appkey: appkey,
      channel: (info["UMENG_CHANNEL"] as? String) ?? "App Store",
      wechatAppid: info["UMENG_WECHAT_APPID"] as? String,
      wechatSecret: info["UMENG_WECHAT_APPSECRET"] as? String,
      wechatUniversalLink: info["UMENG_WECHAT_UNIVERSAL_LINK"] as? String,
      dingtalkAppid: info["UMENG_DINGTALK_APPID"] as? String
    )
  }
}
