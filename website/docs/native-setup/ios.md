---
sidebar_position: 1
title: iOS 原生配置
description: Info.plist URL Scheme、AppDelegate.swift 回调、Podfile 注意事项、微信 Universal Link 配置。
---

# iOS 原生配置

## `ios/<App>/Info.plist`

> 友盟 appkey / appsecret / Universal Link 等配置通过 JS `Common.preInit(config)` 传，**不写在 Info.plist**。Info.plist 只配 iOS 系统强制的 URL Scheme 查询白名单 + 回调注册：

```xml
<!-- iOS 9+ 强制：声明 App 想用哪些第三方 App 的 URL Scheme 查询/跳转 -->
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

<!-- 接收微信/钉钉分享回调跳回 App。URL Scheme 由各平台开放平台分配：
     微信 = "wx" + appid；钉钉 = "dingoa" + appid -->
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

:::tip appkey 走 JS，不写 plist
友盟 appkey、微信 AppSecret、Universal Link 等敏感配置通过 JS `Common.preInit({ appkey, wechatAppId, ... })` 传入，不需要写在 Info.plist。
:::

---

## `ios/<App>/AppDelegate.swift`

```swift
import UIKit
// UmengBootstrap 是 @unif/react-native-umeng 桥导出的 Objective-C class，
// CocoaPods 装好后由 ReactNativeUmeng pod 的 public headers 暴露给宿主，
// Swift 端自动 bridge，无需写 bridging header。

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
Swift ↔ Objective-C 桥接命名规则：ObjC instance method `handleOpenURL:options:` 首参类型是 `NSURL`，Swift 的 omit-needless-words 规则会去掉方法名末尾跟首参类型重复的 `URL`，导入成 **`handleOpen(_:options:)`**（不是 `handleOpenURL`）。写 `handleOpenURL` 会编译报 `has been renamed to 'handleOpen(_:options:)'`。

<details>
<summary>Swift omit-needless-words 规则说明</summary>

Swift 导入 ObjC 时，若方法名末尾的词与首参类型名（去 `NS` 前缀后）完全匹配，则自动省略。例：

- `handleOpenURL:options:` → 首参 `NSURL` → 末尾 `URL` 与类型名 `URL` 匹配 → 省略 → **`handleOpen(_:options:)`**
- `handleUniversalLink:` → 首参 `NSUserActivity` → 末尾 `Link` 与类型名 `UserActivity` 不匹配 → 不省略 → 保持 **`handleUniversalLink(_:)`**

</details>
:::

---

## `ios/Podfile`

```ruby
target 'YourApp' do
  config = use_native_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
```

:::warning 模拟器限制——用真机测分享
友盟 UMShare 6.11.1 在 Apple Silicon Mac 模拟器上有 `EXCLUDED_ARCHS=arm64` 限制（友盟旧式 .framework 没出 arm64 simulator slice）。**用真机测试微信/钉钉分享即可**，模拟器跑不起来不影响生产。强制清 `EXCLUDED_ARCHS` 让模拟器跑起来反而可能在编译期触发 arm64 链接错。
:::

---

## 微信 Universal Link

微信 SDK 1.8.6+ 强制 Universal Link：

1. 到 Apple Developer Portal 为 App ID 启用 **Associated Domains** capability
2. 在服务器部署 `apple-app-site-association` 文件（路径 `/.well-known/apple-app-site-association`）
3. Xcode Entitlements 加 `applinks:your.host`
4. 将对应的 `https://your.host/` 传给 `Common.preInit({ wechatUniversalLink })`

详见微信开放平台官方文档。

---

## 平台支持

| 配置项 | iOS | Android |
| --- | --- | --- |
| LSApplicationQueriesSchemes | ✅ 必填 | — |
| CFBundleURLTypes | ✅ 必填 | — |
| AppDelegate 回调 | ✅ 必填 | — |
| 微信 Universal Link | ✅ 1.8.6+ 强制 | — |

## 相关

- [Android 原生配置](./android)
- [快速上手](../getting-started/quick-start)
