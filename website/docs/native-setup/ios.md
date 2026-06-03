---
sidebar_position: 1
title: iOS 原生配置
description: "iOS 原生接入：Info.plist 配 LSApplicationQueriesSchemes（weixin / dingtalk 等 scheme 白名单）+ CFBundleURLTypes 回调 scheme（微信 wx+appid、钉钉 dingoa+appid）；AppDelegate 把 open url / continue userActivity 转发给桥导出的 UmengBootstrap，方法名是 handleOpen(_:options:)（Swift omit-needless-words）不是 handleOpenURL；微信 1.8.6+ 强制 Universal Link。appkey 等配置走 JS preInit，不写 plist。"
---

# iOS 原生配置

分享后能否跳回 App 全靠原生侧 URL Scheme 与回调注册。**模板别凭记忆编**，逐项核对本页。

:::tip appkey 走 JS，不写 plist
友盟 appkey、微信 AppSecret、Universal Link 等配置通过 JS [`Common.preInit({ appkey, wechatAppId, ... })`](../api/common#preinit) 传入，**不写在 Info.plist**。Info.plist 只配 iOS 系统强制的 URL Scheme 白名单 + 回调 scheme。
:::

---

## `ios/<App>/Info.plist` {#info-plist}

```xml
<!-- iOS 9+ 强制:声明 App 想用哪些第三方 App 的 URL Scheme 查询 / 跳转 -->
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>weixin</string>
  <string>weixinULAPI</string>
  <string>weixinURLParamsAPI</string>
  <string>wechat</string>
  <string>dingtalk</string>
  <string>dingtalk-open</string>
  <string>dingtalk-sso</string>
</array>

<!-- 接收微信 / 钉钉分享回调跳回 App。URL Scheme 由各平台开放平台分配:
     微信 = "wx" + appid;钉钉 = "dingoa" + appid -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>weixin</string>
    <key>CFBundleURLSchemes</key>
    <array><string>wxXXXXXXXX</string></array>
  </dict>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>dingtalk</string>
    <key>CFBundleURLSchemes</key>
    <array><string>dingoaXXXXXXXX</string></array>
  </dict>
</array>
```

| 键 | 必填 | 说明 |
| --- | --- | --- |
| `LSApplicationQueriesSchemes` | ✅ | 第三方 App scheme 查询白名单，缺则 `isInstalled` / 跳转判断不准 |
| `CFBundleURLTypes` | ✅ | 回调 scheme（`wx`+appid、`dingoa`+appid），缺则分享后跳不回 App |

---

## `ios/<App>/AppDelegate.swift` {#appdelegate}

把 `open url` 与 `continue userActivity` 转发给桥导出的 `UmengBootstrap`。

```swift
import UIKit
// UmengBootstrap 是 @unif/react-native-umeng 桥导出的 Objective-C class,
// CocoaPods 装好后由 ReactNativeUmeng pod 的 public header 暴露给宿主,
// Swift 端自动 bridge,无需写 bridging header。

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ app: UIApplication, open url: URL,
                   options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return UmengBootstrap.shared().handleOpen(url, options: options)
  }

  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return UmengBootstrap.shared().handleUniversalLink(userActivity)
  }
}
```

:::danger 是 `handleOpen(_:options:)`，不是 `handleOpenURL`
桥侧 Objective-C 方法签名是 `handleOpenURL:options:`，首参类型 `NSURL`。Swift 的 omit-needless-words 规则会去掉方法名末尾与首参类型重复的 `URL`，导入成 **`handleOpen(_:options:)`**。写 `handleOpenURL` 会编译报 `has been renamed to 'handleOpen(_:options:)'`。

<details>
<summary>Swift omit-needless-words 规则说明</summary>

Swift 导入 ObjC 时，若方法名末尾的词与首参类型名（去 `NS` 前缀后）完全匹配，则自动省略：

- `handleOpenURL:options:` → 首参 `NSURL` → 末尾 `URL` 与类型名 `URL` 匹配 → 省略 → **`handleOpen(_:options:)`**
- `handleUniversalLink:` → 首参 `NSUserActivity` → 末尾 `Link` 与 `UserActivity` 不匹配 → 不省略 → 保持 **`handleUniversalLink(_:)`**

</details>
:::

| 转发方法（Swift 侧） | 触发场景 |
| --- | --- |
| `handleOpen(_:options:)` | App 通过 URL Scheme 被分享回调拉起 |
| `handleUniversalLink(_:)` | 微信 Universal Link 回跳（1.8.6+ 必需） |

---

## `ios/Podfile` {#podfile}

无需特殊配置，标准 RN 新架构 Podfile 即可（`use_native_modules!` 会自动装入 `ReactNativeUmeng` pod 及其友盟依赖 `UMCommon` / `UMDevice` / `UMShare`）。

```ruby
target 'YourApp' do
  config = use_native_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
```

:::warning 模拟器限制 —— 用真机测分享
友盟 U-Share 在 Apple Silicon Mac 模拟器上有 `EXCLUDED_ARCHS=arm64` 限制（旧式 `.framework` 未出 arm64 simulator slice）。**用真机测试微信 / 钉钉分享**。强制清 `EXCLUDED_ARCHS` 反而可能在编译期触发 arm64 链接错。
:::

---

## 微信 Universal Link {#universal-link}

微信 SDK 1.8.6+ 强制 Universal Link：

1. 到 Apple Developer Portal 为 App ID 启用 **Associated Domains** capability。
2. 在服务器部署 `apple-app-site-association` 文件（路径 `/.well-known/apple-app-site-association`）。
3. Xcode Entitlements 加 `applinks:your.host`。
4. 把对应的 `https://your.host/` 传给 [`Common.preInit({ wechatUniversalLink })`](../api/common#umenginitconfig)。

详见微信开放平台官方文档。

---

## 平台支持 {#platform-support}

| 配置项 | iOS | Android |
| --- | --- | --- |
| `LSApplicationQueriesSchemes` | ✅ 必填 | — |
| `CFBundleURLTypes` | ✅ 必填 | — |
| AppDelegate 转发 | ✅ 必填 | — |
| 微信 Universal Link | ✅ 1.8.6+ 强制 | — |

## 相关 {#related}

- [Android 原生配置](./android) —— 回调 Activity / 权限 / queries
- [快速上手](../getting-started/quick-start) —— 完整接入流程
- [常见问题 → 分享无回调](../troubleshooting#native-callback) —— 原生未注册的排障
