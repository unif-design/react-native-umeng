---
sidebar_position: 1
title: iOS 原生配置
description: "iOS 原生接入：URL Types 使用平台分配原值，配置 queries、Associated Domains/AASA，并让 AppDelegate/SceneDelegate 分别调用 Umeng 与 RCTLinkingManager 后再 OR。"
---

# iOS 原生配置

分享后能否跳回 App，取决于 URL Scheme、Universal Link 与宿主 lifecycle 转发。友盟 appkey、微信 App Secret、Universal Link 等凭据不写进 plist；它们先由 JS `Common.preInit(config)` 保存，用户同意后调用 `Common.init()` 才跨入 native/vendor。

:::info 当前验证边界
仓库已经通过 `ReactNativeUmeng` Swift module、三个 Codegen modulesProvider、Common bootstrap、Share/Analytics init gate、AppDelegate/Scene compile fixture、simulator build 与 30/30 XCTest。模拟器没有真实微信 / 钉钉；平台拉起、回包、URL Scheme、Universal Link 与生产 AASA 仍须带真实凭据在真机验证。
:::

## `ios/<App>/Info.plist` {#info-plist}

```xml
<!-- iOS 9+ 的第三方 App scheme 查询白名单 -->
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>weixin</string>
  <string>dingtalk</string>
  <string>dingtalk-open</string>
</array>

<!-- 入站回调 scheme：填写开放平台分配值的原文 -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLName</key>
    <string>wechat</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>YOUR_WECHAT_APP_ID</string>
    </array>
  </dict>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLName</key>
    <string>dingtalk</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>YOUR_DINGTALK_APP_KEY</string>
    </array>
  </dict>
</array>
```

| 键 | 说明 |
| --- | --- |
| `LSApplicationQueriesSchemes` | `isInstalled` / 第三方跳转所需的查询白名单 |
| `CFBundleURLTypes` | 微信 App ID 与钉钉 AppKey / Client ID 的**平台分配原值** |

微信 App ID 本身通常以 `wx` 开头，钉钉旧 AppKey 也可能包含 `dingoa`；“使用原值”表示不要在平台分配值之外再手工拼一次前缀。

## `ios/<App>/AppDelegate.swift` {#appdelegate}

URL Scheme 与 Universal Link 都要分别通知 Umeng 和 React Native `RCTLinkingManager`。先执行两个调用、再对保存的结果做 OR；不要写成单个短路表达式，否则前一个返回 `true` 时第二个 handler 不会运行。

```swift
import UIKit
import React
import ReactNativeUmeng

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
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
```

`ReactNativeUmeng.podspec` 已固定 `module_name = "ReactNativeUmeng"`、`DEFINES_MODULE = YES` 并公开 `UmengBootstrap.h`，因此 Swift 宿主可显式 `import ReactNativeUmeng`。

:::note Swift 方法名是 `handleOpen(_:options:)`
Objective-C 声明为 `handleOpenURL:options:`，Swift importer 会省略与首参 `URL` 类型重复的尾词，因此调用写成 `handleOpen(_:options:)`。`handleUniversalLink(_:)` 保持原名。
:::

回调发生在尚未初始化时，Umeng handler 返回 `false`，不会为了接回调而自动初始化 vendor；`RCTLinkingManager` 仍会收到事件。若产品要在冷启动接住平台回调，宿主需基于已持久化的**用户同意状态**设计合规启动流程；本包不会持久化 appkey/secret 或自动恢复初始化。

## 使用 SceneDelegate 的宿主 {#scene-delegate}

使用 Scene lifecycle 时，除 AppDelegate 外还要覆盖 warm URL、warm Universal Link，以及 `willConnectTo` 的 cold URL/Universal Link。仓库中的 `SceneDelegateFixture.swift` 已编译验证以下结构：

```swift
import React
import ReactNativeUmeng
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    for context in contexts {
      let options = applicationOptions(for: context)
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
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    forward(userActivity)
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    for context in connectionOptions.urlContexts {
      let options = applicationOptions(for: context)
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
    connectionOptions.userActivities.forEach(forward)
  }

  private func forward(_ userActivity: NSUserActivity) {
    let umengHandled = UmengBootstrap.shared().handleUniversalLink(userActivity)
    let reactHandled = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
    _ = umengHandled || reactHandled
  }

  private func applicationOptions(
    for context: UIOpenURLContext
  ) -> [UIApplication.OpenURLOptionsKey: Any] {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: context.options.openInPlace,
    ]
    if let source = context.options.sourceApplication {
      options[.sourceApplication] = source
    }
    if let annotation = context.options.annotation {
      options[.annotation] = annotation
    }
    if let attribution = context.options.eventAttribution {
      options[.eventAttribution] = attribution
    }
    return options
  }
}
```

把 fixture 结构迁入真实 SceneDelegate 后，还要按宿主 lifecycle 配置注册它；example 只把 fixture 放进 Compile Sources，没有注册 runtime scene manifest。

## Pods 与 Codegen {#podfile}

使用标准 RN New Architecture Podfile，由 `use_native_modules!` 安装本 pod 与友盟依赖：

```ruby
target 'YourApp' do
  config = use_native_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
```

依赖变化后：

```sh
cd ios
bundle exec pod install
```

仓库生成的 `RCTModuleProviders.mm` 已验证包含 `UmengCommon`、`UmengAnalytics`、`UmengShare` 三个精确映射。消费者仍须在自己的 Pod 图实际 build，不能只以 `pod install` 成功推断 runtime lookup 一定成功。

## 微信 Universal Link {#universal-link}

微信 Universal Link 需要 App 与网站双向配置：

1. 在 Apple Developer / Xcode 为 App target 启用 **Associated Domains**，entitlements 添加 `applinks:your.host`。这里只写域名，不带 scheme、path、query 或尾随 `/`。
2. 网站通过有效 HTTPS 在 `/.well-known/apple-app-site-association` 提供 AASA，响应不得重定向。
3. AASA 的 app identifier 使用正确的 `TEAM_ID.BUNDLE_ID`，并让 paths/components 覆盖真实回调 path。
4. `Common.preInit({ wechatUniversalLink })` 传入带 host 的绝对 HTTPS URL；其 host、path 与 entitlement/AASA 相互对应。

最小 legacy AASA 示例：

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.example.app",
        "paths": ["/wechat/*"]
      }
    ]
  }
}
```

占位 Team ID、Bundle ID、域名和 path 必须替换为生产值。AASA 可访问不等于回跳已生效；安装 App 后仍要在真机从第三方 App 完成整条链路。

## 初始化顺序 {#initialization-order}

iOS 没有公开 vendor preInit API。用户授权后的 `Common.init()` 在主线程依次执行：

1. 配置微信 Universal Link。
2. 注册微信平台。
3. 注册钉钉平台。
4. `UMConfigure.initWithAppkey`。

`Common.preInit(config)` 在此之前只处理 JS 快照，零 native/vendor 调用。Share 在 init 前 reject `E_NOT_INITIALIZED`；Analytics 在 init 前同步 no-op。

## 平台支持 {#platform-support}

| 配置/门禁 | 当前仓库证据 | 消费者仍需验证 |
| --- | --- | --- |
| `ReactNativeUmeng` module + Codegen provider | simulator build / provider scan PASS | 自己的 Pod 图与 runtime lookup |
| Common/Share/Analytics native gate | 30/30 XCTest PASS | 真实 vendor 行为 |
| AppDelegate URL/UL 双路转发 | example compile + XCTest PASS | 真实 URL Scheme 回跳 |
| Scene warm/cold 双路转发 | compile fixture PASS | 真实 Scene lifecycle 注册与回跳 |
| queries / URL Types / entitlement | example plist/entitlement lint PASS | 替换真实平台原值与域名 |
| AASA / Universal Link | 配置契约已文档化 | HTTPS、无重定向、TeamID.BundleID/path/domain 与真机 |

## 相关 {#related}

- [Android 原生配置](./android) —— 回调 Activity / 权限 / queries
- [快速上手](../getting-started/quick-start) —— 完整接入流程
- [常见问题 → 分享无回调](../troubleshooting#native-callback) —— 原生未注册的排障

## 官方参考

- [React Native 0.85 Linking](https://reactnative.dev/docs/0.85/linking)
- [Apple: Supporting universal links in your app](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [Apple: Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- [友盟 U-Share iOS 开发者中心](https://devs.umeng.com/?component=share&platform=ios)
