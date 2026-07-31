---
sidebar_position: 1
title: iOS 原生配置
description: "iOS remediation 目标：URL Types 使用平台原值，Associated Domains/AASA 配套，AppDelegate/SceneDelegate 同时转发 Umeng 与 RCTLinkingManager；当前 native initialize 与 Pod/Codegen 尚未完成。"
---

# iOS 原生配置

本页记录**已批准的 iOS remediation 目标**,供 Task 9 及后续 iOS 回调任务实现和验收。

:::danger 当前分支 iOS 尚未可用
JS Codegen spec 已改为 `NativeUmengCommon.initialize(config)`,但当前 `ios/UmengCommon.mm` 仍只实现旧 `preInit/init`;`UmengBootstrap` 也仍在旧 `ensurePreInit/ensureInit` 路径中授权前注册平台。Podspec 尚未声明稳定的 `ReactNativeUmeng` module,`package.json#codegenConfig.ios.modulesProvider` 也未落地。因此下列 Swift import、初始化与双路回调都是**整改验收目标**,不是当前已完成能力。
:::

:::tip appkey 走 JS，不写 plist
友盟 appkey、微信 AppSecret、Universal Link 等配置先由 JS [`Common.preInit({ appkey, wechatAppId, ... })`](../api/common#preinit) 保存,用户授权后的 `Common.init()` 才交给 native,**不写在 Info.plist**。Info.plist 只配 iOS 系统强制的 URL 查询白名单与入站回调 scheme。
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

<!-- 接收微信 / 钉钉分享回调跳回 App。填写开放平台分配值的原文:
     微信 App ID / 钉钉 AppKey 或 Client ID,不要自行拼 wx / dingoa 前缀。 -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>weixin</string>
    <key>CFBundleURLSchemes</key>
    <array><string>YOUR_WECHAT_APP_ID</string></array>
  </dict>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>dingtalk</string>
    <key>CFBundleURLSchemes</key>
    <array><string>YOUR_DINGTALK_APP_KEY</string></array>
  </dict>
</array>
```

| 键 | 必填 | 说明 |
| --- | --- | --- |
| `LSApplicationQueriesSchemes` | ✅ | 第三方 App scheme 查询白名单，缺则 `isInstalled` / 跳转判断不准 |
| `CFBundleURLTypes` | ✅ | 微信 App ID 与钉钉 AppKey / Client ID 原值;不得自行加 `wx` / `dingoa`,缺则分享后跳不回 App |

---

## `ios/<App>/AppDelegate.swift` {#appdelegate}

整改完成后,`open URL` 与 `continue userActivity` 都要分别通知 Umeng 和 React Native `RCTLinkingManager`,两个 handler **都执行完**再返回逻辑 OR。不能写 `umengHandled || RCTLinkingManager...`,因为左侧为 `true` 时会短路 React Native Linking。

```swift
import UIKit
import React
import ReactNativeUmeng // 仅在 Task 9 的 module map / public header 落地后可用

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ app: UIApplication, open url: URL,
                   options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    let umengHandled = UmengBootstrap.shared().handleOpen(url, options: options)
    let reactHandled = RCTLinkingManager.application(
      app,
      open: url,
      options: options
    )
    return umengHandled || reactHandled
  }

  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    let umengHandled = UmengBootstrap.shared().handleUniversalLink(userActivity)
    let reactHandled = RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
    return umengHandled || reactHandled
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

:::warning module import 也是待验收目标
只有在 Podspec 增加 `s.module_name = "ReactNativeUmeng"`、`DEFINES_MODULE=YES`,保留 `UmengBootstrap.h` 为 public header,并为三个 TurboModule 配好 iOS `modulesProvider` 后,`import ReactNativeUmeng` 才有稳定依据。`pod install` 成功或 Swift 能看到某个偶然 umbrella header,都不能替代生成 provider 与 runtime lookup 验证。
:::

| 转发方法（Swift 侧） | 触发场景 |
| --- | --- |
| `handleOpen(_:options:)` | App 通过 URL Scheme 被分享回调拉起 |
| `handleUniversalLink(_:)` | 微信 Universal Link 回跳（1.8.6+ 必需） |

---

## 使用 SceneDelegate 的宿主(整改目标) {#scene-delegate}

如果 App 使用 Scene lifecycle,仅改 AppDelegate 不够。必须覆盖 warm URL、warm Universal Link 与 `willConnectTo` 的冷启动 connection options,每条路径同样双路转发。下面 helper 展示目标结构;当前仓会以 compile-only fixture 验证,但尚未落地:

```swift
import UIKit
import React
import ReactNativeUmeng

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  private func openURL(_ context: UIOpenURLContext) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: context.options.openInPlace,
    ]
    if let source = context.options.sourceApplication {
      options[.sourceApplication] = source
    }
    if let annotation = context.options.annotation as Any? {
      options[.annotation] = annotation
    }

    let umengHandled = UmengBootstrap.shared().handleOpen(
      context.url,
      options: options
    )
    let reactHandled = RCTLinkingManager.application(
      UIApplication.shared,
      open: context.url,
      options: options
    )
    _ = umengHandled || reactHandled
  }

  private func continueActivity(_ userActivity: NSUserActivity) {
    let umengHandled = UmengBootstrap.shared().handleUniversalLink(userActivity)
    let reactHandled = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
    _ = umengHandled || reactHandled
  }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    contexts.forEach(openURL)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    continueActivity(userActivity)
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    connectionOptions.urlContexts.forEach(openURL)
    connectionOptions.userActivities.forEach(continueActivity)
  }
}
```

冷启动回调不会替应用保存授权或凭据。目标 `UmengBootstrap` 在未初始化时对 Umeng handler 返回 `false`,但 `RCTLinkingManager` 仍必须收到事件。若业务要在冷启动时接住平台分享回调,需自行设计合规的 native 授权状态恢复;本包不会在回调路径自动初始化 vendor SDK。

---

## `ios/Podfile` {#podfile}

目标仍使用标准 RN 新架构 Podfile,由 `use_native_modules!` 自动安装 pod 及友盟依赖:

```ruby
target 'YourApp' do
  config = use_native_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
```

:::danger 当前不能用“标准 Podfile”推导已支持
当前 Podspec/Codegen/module contract 尚未完成。Task 9 必须让 Swift fixture 实际 `import ReactNativeUmeng` 并调用 `UmengBootstrap`,检查生成的 `RCTModuleProviders.mm` 含 `UmengCommon` / `UmengAnalytics` / `UmengShare`,再通过 simulator build。真实微信 / 钉钉跳转仍需真机,但 simulator 编译失败不是预期成功条件。
:::

---

## 微信 Universal Link {#universal-link}

微信 SDK 1.8.6+ 强制 Universal Link。整改验收必须同时满足三处配置:

1. 到 Apple Developer Portal 为 App ID 启用 **Associated Domains** capability,Entitlements 写 `applinks:your.host`(**不带 URL path**)。
2. 站点通过 HTTPS 在 `/.well-known/apple-app-site-association` 提供 AASA;证书有效、响应不重定向,`appID` 使用正确的 `TEAM_ID.BUNDLE_ID`,并放行实际路径。
3. [`Common.preInit({ wechatUniversalLink })`](../api/common#umenginitconfig) 传入的绝对 HTTPS URL,其 host 与 entitlement/AASA 域名一致。

最小 AASA 结构示例:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.example.app",
        "paths": ["/*"]
      }
    ]
  }
}
```

占位 Team ID、Bundle ID、域名和 path 必须替换为生产值;真实回跳需带凭据真机验收。

---

## 平台支持 {#platform-support}

| 配置项 | iOS | Android |
| --- | --- | --- |
| `LSApplicationQueriesSchemes` | ⏳ 已批准目标,待 iOS remediation 验收 | — |
| `CFBundleURLTypes` 原值 | ⏳ 已批准目标,待 iOS remediation 验收 | — |
| AppDelegate 双路转发 | ⏳ 待实现 | — |
| SceneDelegate warm/cold 双路转发 | ⏳ 使用 Scene 时必做,待 fixture 验收 | — |
| Pod module + Codegen registration | ⏳ Task 9 | — |
| Associated Domains + AASA | ⏳ 微信必做,待真机验收 | — |

## 相关 {#related}

- [Android 原生配置](./android) —— 回调 Activity / 权限 / queries
- [快速上手](../getting-started/quick-start) —— 完整接入流程
- [常见问题 → 分享无回调](../troubleshooting#native-callback) —— 原生未注册的排障
