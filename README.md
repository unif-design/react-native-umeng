# @unif/react-native-umeng

[![npm](https://img.shields.io/npm/v/@unif/react-native-umeng.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-umeng)
[![CI](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-umeng.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-umeng/)

友盟 React Native bridge：U-Share（微信会话 / 钉钉）+ U-App 移动统计。Unif 私有。

## 安装

```sh
yarn add @unif/react-native-umeng @unif/react-native-design @gorhom/bottom-sheet react-native-gesture-handler react-native-svg
```

## JS API

```ts
import {
  Common,
  Share,
  Analytics,
  Platform,
  ShareSheetHost,
} from '@unif/react-native-umeng';

// 1. App 启动后立刻预初始化 (可在 user 同意《隐私协议》之前)
//    行为:存 config + setPlaform 注册微信/钉钉,**不上报数据**。
await Common.preInit({
  appkey: 'YOUR_UMENG_APPKEY',
  channel: 'App Store',                      // 可选,默认 'App Store' (iOS) / 'default' (Android)
  wechatAppId: 'wxXXXXXXXX',                 // 可选,配了才注册微信
  wechatAppSecret: 'XXXXXXXX',               // 跟 wechatAppId 配套
  wechatUniversalLink: 'https://your.host/', // iOS 微信 1.8.6+ 强制
  dingtalkAppId: 'dingoaXXXXXXXX',           // 可选,配了才注册钉钉
});

// 2. 用户同意《隐私协议》后,正式启动数据采集 (preInit 必须先调过)
await Common.init();

// 2. 命令式分享面板（推荐）
const r = await Share.openSheet({
  type: 'link',
  title: '问问看',
  url: 'https://example.com',
  description: '一句话描述',
});
// r = { code: 'success' | 'cancel' | 'failed', platform, message? }

// 3. 跳过面板直拉
await Share.shareLink({
  platform: Platform.WECHAT_SESSION,
  title: 'T',
  url: 'https://x',
});

// 4. 统计
Analytics.onEvent('login', { channel: 'wechat' });
Analytics.signIn('user-123', 'WX');
Analytics.signOut();
```

## 宿主 App 集成

### 根组件挂载

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import { ShareSheetHost } from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <YourNavigationStack />
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

### iOS

#### `ios/<App>/Info.plist`

> 友盟 appkey / appsecret / Universal Link 等配置通过 JS `Common.init(config)` 传,**不写在 Info.plist**。Info.plist 只配 iOS 系统强制的 URL Scheme 查询白名单 + 回调注册:

```xml
<!-- iOS 9+ 强制:声明 App 想用哪些第三方 App 的 URL Scheme 查询/跳转 -->
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

<!-- 接收微信/钉钉分享回调跳回 App。URL Scheme 由各平台开放平台分配:
     微信 = "wx" + appid; 钉钉 = "dingoa" + appid -->
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

#### `ios/<App>/AppDelegate.swift`

```swift
import UIKit
// UmengBootstrap 是 @unif/react-native-umeng 桥导出的 Objective-C class,
// CocoaPods 装好后由 ReactNativeUmeng pod 的 public headers 暴露给宿主,
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

> Swift ↔ Objective-C 桥接命名规则:ObjC class method `+ (instancetype)shared;` Swift 端是 `UmengBootstrap.shared()`(带括号,不是属性);ObjC instance method `handleOpenURL:options:` 首参类型是 `NSURL`,Swift 的 omit-needless-words 规则会去掉方法名末尾跟首参类型重复的 `URL`,导入成 **`handleOpen(_:options:)`**(不是 `handleOpenURL`,写 `handleOpenURL` 会编译报 `has been renamed to 'handleOpen(_:options:)'`)。`handleUniversalLink:` 首参 `NSUserActivity`、方法名末尾 `Link` 非类型名,不简化,保持 `handleUniversalLink(_:)`。

#### `ios/Podfile`

```ruby
target 'YourApp' do
  config = use_native_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
```

> **真机测试**：友盟 UMShare 6.11.1 在 Apple Silicon Mac 模拟器上有 `EXCLUDED_ARCHS=arm64` 限制（友盟旧式 .framework 没出 arm64 simulator slice）。**用真机测试微信/钉钉分享即可**，模拟器跑不起来不影响生产。强制清 `EXCLUDED_ARCHS` 让模拟器跑起来反而可能在编译期触发 arm64 链接错。

#### 微信 Universal Link

微信 SDK 1.8.6+ 强制 UL：到 Apple Developer 启用 Associated Domains，部署 `apple-app-site-association`，Entitlements 加 `applinks:your.host`。详见微信开放平台文档。

### Android

#### `android/app/src/main/AndroidManifest.xml`

> ✅ 不需要写 `<uses-permission>` 和 `<queries>` — `@unif/react-native-umeng` 的 library Manifest 已经声明,Android manifest merger 自动合并到宿主。
> ✅ 不需要写友盟相关 `<meta-data>` — appkey 等通过 JS `Common.preInit(config)` 传。
>
> **仅需注册两个回调 Activity**（微信/钉钉 SDK 硬限制:必须在宿主包名下,SDK 用 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"` 反射查找,不能放在 library 包）:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <!-- 微信回调 Activity（友盟提供基类,一行空类,见下） -->
    <activity
      android:name=".wxapi.WXEntryActivity"
      android:configChanges="keyboardHidden|orientation|screenSize"
      android:exported="true"
      android:theme="@android:style/Theme.Translucent.NoTitleBar"/>

    <!-- 钉钉回调 Activity（必须叫 DDShareActivity;包路径固定） -->
    <activity
      android:name=".ddshare.DDShareActivity"
      android:configChanges="keyboardHidden|orientation|screenSize"
      android:exported="true"
      android:launchMode="singleInstance"
      android:theme="@android:style/Theme.Translucent.NoTitleBar"/>
  </application>
</manifest>
```

#### 微信回调 — `<appPkg>/wxapi/WXEntryActivity.kt`

```kotlin
package com.example.app.wxapi

import com.umeng.socialize.weixin.view.WXCallbackActivity

class WXEntryActivity : WXCallbackActivity()
```

#### 钉钉回调 — `<appPkg>/ddshare/DDShareActivity.kt`

```kotlin
package com.example.app.ddshare

import android.app.Activity
import android.os.Bundle
import com.example.app.BuildConfig
import com.android.dingtalk.share.ddsharemodule.DDShareApiFactory
import com.android.dingtalk.share.ddsharemodule.IDDAPIEventHandler
import com.android.dingtalk.share.ddsharemodule.IDDShareApi
import com.android.dingtalk.share.ddsharemodule.message.BaseReq
import com.android.dingtalk.share.ddsharemodule.message.BaseResp

class DDShareActivity : Activity(), IDDAPIEventHandler {
  private lateinit var iddShareApi: IDDShareApi

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // ⚠️ 这个 appId 必须跟 JS 端 Common.preInit({ dingtalkAppId: '...' }) 传的值一致。
    // 钉钉 SDK 要求 Activity onCreate 时就传 appId 建 ShareApi 实例,且冷启动可能直接
    // 拉起本 Activity(JS 还没跑),所以只能 native 侧拿、读不到 JS config —— 这是钉钉
    // 官方 Android 接入的固有形态(官方示例也是 onCreate 传常量)。为避免两处写死漂移,
    // 用构建时单一数据源 BuildConfig.DINGTALK_APPID(定义见下)。
    val appId = BuildConfig.DINGTALK_APPID
    iddShareApi = DDShareApiFactory.createDDShareApi(this, appId, false)
    iddShareApi.handleIntent(intent, this)
  }

  override fun onReq(req: BaseReq) {}
  override fun onResp(resp: BaseResp) {
    // 友盟 7.3.7 钉钉回调由 SDK 内部 hook，此处 finish 即可
    finish()
  }
}
```

> **单一数据源(推荐)**：钉钉 appId 在 `app/build.gradle` 用 `buildConfigField` 定义一次，`DDShareActivity` 读 `BuildConfig.DINGTALK_APPID`，同一个值再传给 JS 的 `Common.preInit({ dingtalkAppId })` —— 两处共用一个常量，避免漂移。
>
> ```gradle
> // android/app/build.gradle
> android {
>   defaultConfig {
>     buildConfigField "String", "DINGTALK_APPID", "\"dingoaXXXXXXXX\""
>   }
>   buildFeatures { buildConfig = true }   // AGP 8+ 默认关，需显式开
> }
> ```

#### 宿主 MainActivity

✅ 不需要 override `onActivityResult` 或 `onDestroy` 转发给 `UMShareAPI` — `UmengShareModule` 实现 `ActivityEventListener`,会自动接管 Activity 回调链路,并在 `invalidate()` 时释放 `UMShareAPI`。

#### Proguard

✅ 不需要写 — `@unif/react-native-umeng` 通过 `android/consumer-rules.pro` 自动给宿主 App 合并 R8/proguard 规则（保留友盟 / 微信 / 钉钉相关 class 不被混淆）。release build 直接跑 `./gradlew assembleRelease` 不会因为混淆 crash。

## 测试 / Mocking

宿主 App 用 jest 测自己代码时，`@unif/react-native-umeng` 的 native 绑定在 jest 里加载会崩。库提供了开箱 mock，一行替换：

```ts
// jest setup 或单个测试文件
jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'));
```

替换后：`Common` / `Share` / `Analytics` 方法都是 `jest.fn`，`Share.*` 默认 resolve 成功，`Common.isInited()` 默认 `false`，`ShareSheetHost` 渲染 `null`，纯枚举/常量（`Platform` 等）与 `UmengError` 仍是真实值。

按需覆盖结果（mock 另导出 `shareSuccess` / `shareCancel` / `shareFailed` 助手）：

```ts
import { Share, Platform } from '@unif/react-native-umeng';
import { shareCancel } from '@unif/react-native-umeng/mock';

(Share.shareText as jest.Mock).mockResolvedValueOnce(shareCancel(Platform.WECHAT_SESSION));
```

## 错误码

| code | 含义 |
| --- | --- |
| `E_PLATFORM_NOT_INSTALLED` | 微信/钉钉未安装 |
| `E_PLATFORM_NOT_SUPPORTED` | platform 字串不在白名单 |
| `E_INVALID_OPTIONS` | 参数缺失/类型错 |
| `E_USER_CANCEL` | 用户取消 |
| `E_SHARE_FAILED` | 友盟回调失败（含未配 URL Scheme、网络错等） |
| `E_NOT_INITIALIZED` | （预留） |
| `E_NO_ACTIVITY` | 无前台 Activity（Android：app 在后台时调 share） |
| `E_UNKNOWN` | 其它 |

## PIPL 合规

- **Android**：模块构造时自动 `UMConfigure.preInit`（不采集、不上报）；JS `Common.init()` 后才正式启动数据采集
- **iOS**：友盟 iOS SDK 无 preInit；JS `Common.init()` 之前桥不调任何友盟 API。请保证 `Common.init()` 在用户同意《隐私协议》之后调用

## License

MIT
