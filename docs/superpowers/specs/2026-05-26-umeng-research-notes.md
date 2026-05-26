# 友盟集成研究纪要（U-Share + U-App）

> 研究时间：2026-05-26  
> 方法：两个 Agent 并行通过 Playwright 渲染友盟 SPA 文档、curl Maven 中央仓 POM、curl CocoaPods Trunk JSON、抓 GitHub 上友盟官方 demo 源码  
> 用途：为 `@unif/react-native-umeng` 桥的设计文档和实施计划提供可执行事实清单

---

## 关键风险点（必读）

1. **iOS 端公开 SDK 没有 `preInit`** — 友盟 iOS 公开接口只有 `UMConfigure.initWithAppkey:channel:`。PIPL 合规解法是"用户同意《隐私协议》前完全不调任何友盟 API"。Android 才有 `preInit(ctx, appkey, channel)` + `init(...)` 的两段式。
2. **iOS / Android 版本号体系不同**（**非落后**） — CocoaPods Trunk 实拉日期：`UMShare 6.11.1` (2026-01-07)、`UMCommon 7.5.10` (2026-04-07)、`UMDevice 3.6.0` (2026-05-25)；Android Maven 上 `common 9.9.1`（2026-03-24）、`share-* 7.3.7`。这是友盟在两端用了不同的版本号体系（iOS 走 6.x、Android 走 7.x / 9.x），**功能上是同期版本**。无需手动 zip。
3. **没有 `UMAnalytics` pod** — `MobClick.h` 直接在 `UMCommon` 里。iOS 端只需 `pod 'UMCommon'`。
4. **`UMShare/Social/WeChat` vendored 了 WeChatSDK .a** — 不需要单独装 `WechatOpenSDK-XCFramework`；但内置版本可能落后于 Tencent 官方 2.0.5（2025-07-29）。
5. **`UMShare/Social/DingDing` vendored 了 DTShareKit.framework** — 钉钉 iOS 不需要单独集成。
6. **`UMShare 6.11.1` podspec 的 EXCLUDED_ARCHS** 设了 `arm64` 模拟器 — Apple Silicon Mac 上 simulator 跑不起来，Podfile 需 `post_install` hook 清掉。
7. **钉钉 Android 没有友盟提供的回调 Activity 父类** — 与微信不同（微信有 `WXCallbackActivity`），钉钉的 `DDShareActivity` 必须自己继承 `android.app.Activity` 并 `implements IDDAPIEventHandler`，且必须放在 `<applicationId>.ddshare.DDShareActivity`。
8. **友盟 share-wx / share-dingding 不传递依赖于微信 / 钉钉官方 SDK** — Android 必须**显式声明** `com.tencent.mm.opensdk:wechat-sdk-android:6.8.34` 和 `com.alibaba.android:ddsharesdk:1.2.2`，否则编译期没问题但 runtime 找不到类。
9. **RN 0.85 不支持纯 Swift TurboModule** — 必须用 **ObjC++ shim（`.mm`）+ Swift Adapter（`.swift`）** 的官方 Adapter Pattern。每个 TurboModule 三件套：`.h`（协议符合）+ `.mm`（codegen 协议适配、转发到 Swift）+ `.swift`（业务逻辑、`@objcMembers public class`）。
10. **Android Activity 必须 onActivityResult 转发** — 宿主 Activity 必须实现：  
    ```kotlin
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
      super.onActivityResult(requestCode, resultCode, data)
      UMShareAPI.get(this).onActivityResult(requestCode, resultCode, data)
    }
    ```  
    RN 桥需要拿到 `currentActivity` 才能 `ShareAction(activity).share()`。
11. **U-App 9.3.6+ 已移除崩溃捕获** — `reportError(throwable)` API 在 9.x 已不存在。要崩溃捕获要另装 `com.umeng.umsdk:apm` (U-APM)，超出本桥范围。
12. **iOS Swift 不能用 `use_frameworks!` dynamic** — 因为 UMShare vendored `.a` 文件，必须用 `use_frameworks! :linkage => :static` 或者根本不写；同时必须 `use_modular_headers!` 让 Swift 能 `import UMCommon`。

---

## 一、iOS 集成事实

### 1.1 CocoaPods 依赖（推荐 podspec 写法）

| Pod | 最新版（CocoaPods Trunk 2026-05-26）| 必/可选 | 说明 |
|---|---|---|---|
| `UMCommon` | **7.5.10**（2026-04-07） | 必选 | 提供 `UMConfigure` 与 `MobClick`（统计 + 分享共用） |
| `UMDevice` | **3.6.0**（2026-05-25） | 必选 | 设备标识采集 |
| `UMShare/Core` | **6.11.1**（2026-01-07） | 必选 | 分享核心 |
| `UMShare/Social/WeChat` | 6.11.1 | 微信必选 | **自带 WeChatSDK 二进制** |
| `UMShare/Social/DingDing` | 6.11.1 | 钉钉必选 | **自带 DTShareKit.framework** |
| `UMShare/UI` | 6.11.1 | 不要 | 友盟自带分享面板 UI（本桥不要） |
| `UMShare/Social/ReducedWeChat` | 6.11.1 | 不要 | 微信精简版（不带 WeChatSDK，自集成时用） |

iOS 最低部署：取 **15.1**（RN 0.85 要求；UMShare 自己写 9.0，WechatOpenSDK 写 12.0，钉钉 12.0，都更低）。

> **版本号体系差异**：CocoaPods Trunk 上 UMShare 主版本号是 6.x（最新 6.11.1, 2026-01-07），Android Maven 上是 7.x（最新 7.3.7）。这是友盟在两端独立的版本号体系，**6.11.1 与 7.3.7 是同期版本，功能对齐**。

### 1.2 Info.plist

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>weixin</string>
  <string>weixinULAPI</string>          <!-- 微信 SDK 1.8.6+ 强制 -->
  <string>weixinURLParamsAPI</string>
  <string>wechat</string>
  <string>dingtalk</string>
  <string>dingtalk-open</string>
  <string>dingtalk-sso</string>          <!-- 友盟文档列了，钉钉官方文档没列；保留 -->
</array>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>weixin</string>
    <key>CFBundleURLSchemes</key>
    <array><string>wxYOUR_WECHAT_APPID</string></array>
  </dict>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>dingtalk</string>
    <key>CFBundleURLSchemes</key>
    <array><string>dingoaYOUR_DINGTALK_APPID</string></array>
  </dict>
</array>
```

> `UMENG_APPKEY` **不在** Info.plist 配置 — iOS 端 appkey 通过代码 `UMConfigure.initWithAppkey:channel:` 注入。

### 1.3 AppDelegate（Swift）

```swift
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication,
                   didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    UMConfigure.setLogEnabled(true)
    
    // PIPL：用户同意《隐私协议》之后才能 init
    if hasUserAcceptedPrivacy {
      bootstrapUmeng()
    }
    return true
  }
  
  func bootstrapUmeng() {
    UMConfigure.initWithAppkey("YOUR_UMENG_APPKEY", channel: "App Store")
    
    // 注意：方法名是 setPlaform（少一个 t，SDK 源码错误延续多年）
    UMSocialManager.default()?.setPlaform(
      .wechatSession,
      appKey: "wxYOUR_WECHAT_APPID",
      appSecret: "YOUR_WECHAT_SECRET",
      redirectURL: nil
    )
    UMSocialManager.default()?.setPlaform(
      .dingDing,
      appKey: "YOUR_DINGTALK_APPID",
      appSecret: nil,
      redirectURL: nil
    )
    
    // 微信 Universal Link（强制；必须在 setPlaform 前设置；UMSocialGlobal.h）
    // UMSocialGlobal.shareInstance().universalLinkDic = [
    //   NSNumber(value: UMSocialPlatformType.wechatSession.rawValue): "https://your.host.com/path/"
    // ]
  }
  
  // 回调（iOS 9+）
  func application(_ app: UIApplication, open url: URL,
                   options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return UMSocialManager.default()?.handleOpen(url, options: options) ?? false
  }
  
  // Universal Link 回调（微信新版必备）
  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return UMSocialManager.default()?.handleUniversalLink(userActivity, options: nil) ?? false
  }
}
```

Bridging Header 必须 `#import <UMCommon/UMCommon.h>` 和 `#import <UMShare/UMShare.h>`。

### 1.4 `shareToPlatform` 调用

```swift
// ObjC 原型
// - (void)shareToPlatform:(UMSocialPlatformType)platformType
//          messageObject:(UMSocialMessageObject *)messageObject
//  currentViewController:(id)currentViewController
//             completion:(UMSocialRequestCompletionHandler)completion;

let msg = UMSocialMessageObject()
msg.text = "..."                  // 纯文本分享
// 或者：
let web = UMShareWebpageObject.shareObject(withTitle: "标题", descr: "描述", thumImage: thumbUIImage_or_data_or_URLString)
web.webpageUrl = "https://example.com"
msg.shareObject = web

UMSocialManager.default()?.share(
  to: .wechatSession,
  messageObject: msg,
  currentViewController: nil,    // sms/email 才需要；其他平台传 nil
  completion: { result, error in
    if let nsError = error as NSError? {
      // nsError.domain == UMSocialPlatformErrorDomain
      // nsError.code = 2008(NotInstall) / 2009(Cancel) / 2003(ShareFailed) / ...
    } else {
      // 成功；result 是 UMSocialShareResponse
    }
  }
)
```

### 1.5 `UMSocialPlatformType` 枚举（关键值）

| Swift 名 | rawValue |
|---|---|
| `.wechatSession` | 1 |
| `.wechatTimeLine` | 2 |
| `.dingDing` | **27** |

### 1.6 iOS 错误码（结构化）

`UMSocialPlatformErrorType`（`UMSocialPlatformErrorDomain`）：

| Code | 含义 |
|---|---|
| 2000 | Unknown |
| 2001 | NotSupport |
| 2002 | AuthorizeFailed |
| 2003 | **ShareFailed** |
| 2007 | CheckUrlSchemaFail（URL Scheme 没配对） |
| 2008 | **NotInstall（未安装目标 App）** |
| 2009 | **Cancel（用户取消）** |
| 2010 | NotNetWork |
| 2014 | NotUsingHttps |

### 1.7 iOS isInstall API

文档未在公开 `UMSocialManager.h` 列出明确的 `isInstall` 方法。**保守方案**：在 Swift 端用 `UIApplication.shared.canOpenURL(URL(string: "weixin://")!)` / `dingtalk://` 探测，并在 LSApplicationQueriesSchemes 中声明对应 scheme。

---

## 二、Android 集成事实

### 2.1 Gradle 依赖（必须显式声明全部）

```kotlin
mavenCentral()

dependencies {
  // 友盟基础
  implementation("com.umeng.umsdk:common:9.9.1")
  implementation("com.umeng.umsdk:asms:1.8.7.2")
  
  // 分享
  implementation("com.umeng.umsdk:share-core:7.3.7")
  implementation("com.umeng.umsdk:share-wx:7.3.7")
  implementation("com.umeng.umsdk:share-dingding:7.3.7")
  
  // 微信 / 钉钉官方 SDK（友盟不传递依赖，必须显式）
  implementation("com.tencent.mm.opensdk:wechat-sdk-android:6.8.34")
  implementation("com.alibaba.android:ddsharesdk:1.2.2")
}
```

minSdk：21（Android 5.0）。

### 2.2 AndroidManifest.xml

```xml
<!-- 权限 -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<!-- 7.3.7 已不再使用 READ_PHONE_STATE / READ/WRITE_EXTERNAL_STORAGE -->
<!-- 但 U-App 9.x 文档仍列 READ_PHONE_STATE — 矛盾，实施时验证 -->

<!-- Android 11+ 必须 -->
<queries>
  <package android:name="com.tencent.mm" />
  <package android:name="com.alibaba.android.rimet" />
</queries>

<application>
  <!-- 微信回调 -->
  <activity
    android:name=".wxapi.WXEntryActivity"
    android:configChanges="keyboardHidden|orientation|screenSize"
    android:exported="true"
    android:theme="@android:style/Theme.Translucent.NoTitleBar" />
  
  <!-- 钉钉回调 -->
  <activity
    android:name=".ddshare.DDShareActivity"
    android:configChanges="keyboardHidden|orientation|screenSize"
    android:exported="true"
    android:launchMode="singleInstance"
    android:theme="@android:style/Theme.Translucent.NoTitleBar" />
</application>
```

`UMENG_APPKEY` 通过代码 `UMConfigure.preInit(ctx, "key", "channel")` 传入，**不**写 Manifest meta-data。

### 2.3 微信回调 Activity（基类来自友盟）

```kotlin
package <applicationId>.wxapi

import com.umeng.socialize.weixin.view.WXCallbackActivity

class WXEntryActivity : WXCallbackActivity()
```

**就这么简单 — 友盟 `WXCallbackActivity` 已经处理了 `onReq/onResp` 和 `UMShareAPI` 回调透传**。

### 2.4 钉钉回调 Activity（友盟未提供父类，必须自实现）

```kotlin
package <applicationId>.ddshare

import android.app.Activity
import android.os.Bundle
import com.android.dingtalk.share.ddsharemodule.DDShareApiFactory
import com.android.dingtalk.share.ddsharemodule.IDDAPIEventHandler
import com.android.dingtalk.share.ddsharemodule.IDDShareApi
import com.android.dingtalk.share.ddsharemodule.message.BaseReq
import com.android.dingtalk.share.ddsharemodule.message.BaseResp

class DDShareActivity : Activity(), IDDAPIEventHandler {
  private lateinit var iddShareApi: IDDShareApi
  
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    iddShareApi = DDShareApiFactory.createDDShareApi(this, "YOUR_DINGTALK_APPID", false)
    iddShareApi.handleIntent(intent, this)
  }
  
  override fun onReq(req: BaseReq) { /* 一般无需处理 */ }
  
  override fun onResp(resp: BaseResp) {
    // 透传给友盟（具体透传方法名实施时验证 demo）
    // 候选：UMShareAPI.get(this).onActivityResult(...)？或者特定回调？
    finish()
  }
}
```

> **实施前必须**：打开友盟官方 demo [`umeng/MultiFunctionAndroidMavenDemo-master`](https://github.com/umeng/MultiFunctionAndroidMavenDemo-master) 看 `DDShareActivity.onResp` 的具体透传方式。Agent 抓取时文档未明确给出。

### 2.5 Application.onCreate（Kotlin）

```kotlin
class App : Application() {
  override fun onCreate() {
    super.onCreate()
    UMConfigure.setLogEnabled(BuildConfig.DEBUG)
    
    // PIPL：preInit 可以无差别在 onCreate 调，不上报数据
    UMConfigure.preInit(
      applicationContext,
      "YOUR_UMENG_APPKEY",
      "default_channel"
    )
    
    // 必须在用户同意《隐私协议》之后才调 init
    if (isUserAgreedPrivacy()) {
      umengInit()
    }
  }
  
  private fun umengInit() {
    UMConfigure.init(
      applicationContext,
      "YOUR_UMENG_APPKEY",
      "default_channel",
      UMConfigure.DEVICE_TYPE_PHONE,    // = 1
      ""                                  // pushSecret，不接推送传空
    )
    
    // PlatformConfig 必须在 init 之后
    PlatformConfig.setWeixin("YOUR_WX_APPID", "YOUR_WX_APPSECRET")
    PlatformConfig.setDing("YOUR_DINGTALK_APPID")
    PlatformConfig.setFileProvider("${packageName}.fileprovider")  // 分享本地文件需要
  }
}
```

### 2.6 分享调用（链式 API，不是 doShare）

> **重要修正**：早期教程里的 `UMShareAPI.get(activity).doShare(activity, shareAction, listener)` 不是 7.x API。7.x 用链式 `ShareAction(activity).withXxx().setPlatform().setCallback().share()`。

```kotlin
// 文本
ShareAction(activity)
  .withText("分享文本")
  .setPlatform(SHARE_MEDIA.WEIXIN)         // 微信会话
  .setCallback(shareListener)
  .share()

// 图片（URL 也支持）
val image = UMImage(activity, "https://example.com/big.jpg")
image.setThumb(UMImage(activity, "https://example.com/thumb.jpg"))
ShareAction(activity).withMedia(image)
  .setPlatform(SHARE_MEDIA.WEIXIN).setCallback(shareListener).share()

// 链接
val web = UMWeb("https://example.com")
web.title = "标题"
web.description = "描述"
web.setThumb(UMImage(activity, "https://example.com/thumb.jpg"))
ShareAction(activity).withMedia(web)
  .setPlatform(SHARE_MEDIA.DINGTALK).setCallback(shareListener).share()
```

`SHARE_MEDIA` 关键值：`WEIXIN`（会话）、`WEIXIN_CIRCLE`（朋友圈，本桥不用）、`DINGTALK`。

### 2.7 Activity 必须的转发（宿主 / Host）

```kotlin
class MainActivity : ReactActivity() {
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    UMShareAPI.get(this).onActivityResult(requestCode, resultCode, data)
  }
  
  override fun onDestroy() {
    super.onDestroy()
    UMShareAPI.get(this).release()
  }
}
```

> **RN 桥侧需要**：每次 `share` 调用必须拿到 `currentActivity`（`ReactApplicationContext.currentActivity`），并 dispatch 到主线程。

### 2.8 Android isInstall

`UMShareAPI.get(context).isInstall(activity, platform: SHARE_MEDIA): Boolean`。

### 2.9 Android 错误处理

`UMShareListener` 三个回调：

```kotlin
interface UMShareListener {
  fun onStart(platform: SHARE_MEDIA)
  fun onResult(platform: SHARE_MEDIA)               // success
  fun onError(platform: SHARE_MEDIA, t: Throwable)  // 失败
  fun onCancel(platform: SHARE_MEDIA)               // 取消
}
```

无结构化错误码，仅 `Throwable.message`。

### 2.10 Proguard

```pro
-dontwarn com.umeng.**
-keepattributes *Annotation*

-keep class com.umeng.** {*;}
-keep class com.uyumao.** {*;}
-keep class com.uc.** {*;}       # 9.3.0+ 必加
-keep class com.ut.** {*;}
-keep class com.ta.** {*;}

# 微信
-keep class com.tencent.mm.opensdk.** {*;}
-keep class com.tencent.wxop.** {*;}
-keep class com.tencent.mm.sdk.** {*;}

# 钉钉
-keep class com.alibaba.android.** {*;}

-keep public class **.R$* { public static final int *; }
-keepclassmembers class * { public <init> (org.json.JSONObject); }
-keepclassmembers enum * {
  public static **[] values();
  public static ** valueOf(java.lang.String);
}
```

---

## 三、Swift TurboModule 在 RN 0.85（Adapter Pattern）

### 3.1 RN 官方原文

> "The core of React Native is mainly written in C++ and the interoperability between Swift and C++ is not great... the module you are going to write in this guide won't be a pure Swift implementation due to the incompatibilities between the languages. You'll have to write some Objective-C++ glue code but the goal of the guide is to minimize the amount of Objective-C++ code that is needed."

来源：https://reactnative.dev/docs/the-new-architecture/turbo-modules-with-swift

### 3.2 三件套模板（每个 TurboModule）

**1. `src/NativeXxx.ts`（codegen 输入）**

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  someAsync(arg: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Xxx');
```

**2. `ios/Xxx.h`（OC 协议符合）**

```objc
#import <Foundation/Foundation.h>
#import <UMShareSpec/UMShareSpec.h>   // codegen 生成路径

@interface Xxx : NSObject <NativeXxxSpec>
@end
```

**3. `ios/Xxx.mm`（ObjC++ 桥）**

```objcpp
#import "Xxx.h"
#import "react_native_umeng-Swift.h"   // 自动生成的 Swift -> ObjC 头

@implementation Xxx {
  XxxImpl *_impl;
}

- (instancetype)init {
  if ((self = [super init])) {
    _impl = [[XxxImpl alloc] init];
  }
  return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeXxxSpecJSI>(params);
}

+ (NSString *)moduleName { return @"Xxx"; }

- (void)someAsync:(NSString *)arg
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  [_impl someAsyncWithArg:arg resolve:resolve reject:reject];
}

@end
```

**4. `ios/XxxImpl.swift`（业务逻辑，Swift）**

```swift
import Foundation
import React
import UMCommon
import UMShare

@objcMembers
public class XxxImpl: NSObject {
  public func someAsync(arg: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    // 业务实现
    resolve(arg)
  }
}
```

### 3.3 podspec 关键配置

```ruby
s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
s.pod_target_xcconfig = {
  "DEFINES_MODULE" => "YES",
  "SWIFT_VERSION" => "5.0",
  "CLANG_ENABLE_MODULES" => "YES",
  "OTHER_LDFLAGS" => "$(inherited) -ObjC"
}
install_modules_dependencies(s)   # RN 0.85 helper
```

### 3.4 宿主 Podfile

```ruby
use_frameworks! :linkage => :static    # UMShare vendor .a，禁 dynamic
use_modular_headers!                    # Swift 看到 OC 头必须

post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name.start_with?('UM')
      target.build_configurations.each do |config|
        # 清掉 UMShare 6.11.1 的 EXCLUDED_ARCHS=arm64 simulator
        config.build_settings.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
      end
    end
  end
end
```

### 3.5 不再需要 RCT_EXPORT_MODULE

RN 0.85 New Arch 下，TurboModule 注册改成 `package.json` 的 `codegenConfig.ios.modulesProvider`：

```json
"codegenConfig": {
  "name": "UMShareSpec",
  "type": "modules",
  "jsSrcsDir": "src",
  "ios": {
    "modulesProvider": {
      "UmengCommon": "UmengCommon",
      "UmengShare": "UmengShare",
      "UmengAnalytics": "UmengAnalytics"
    }
  }
}
```

---

## 四、Agent 抓到的全部源 URL 与抓取时间

| URL | 内容 | 抓取时间 |
|---|---|---|
| https://devs.umeng.com/sdk | SDK 下载页（确认 9.9.1 / 7.3.7 / 1.8.7.2 版本） | 2026-05-26 |
| https://developer.umeng.com/docs/147377/detail/210664 | Android PIPL 合规指引 | 2026-05-26 |
| https://developer.umeng.com/docs/147377/detail/214880 | iOS PIPL 合规指引 | 2026-05-26 |
| https://developer.umeng.com/docs/147377/detail/214848 | iOS U-App 接入 | 2026-05-26 |
| https://developer.umeng.com/docs/119267/detail/118584 | Android U-App 接入 | 2026-05-26 |
| https://developer.umeng.com/docs/119267/detail/118588 | Android UMConfigure API | 2026-05-26 |
| https://developer.umeng.com/docs/119267/detail/118637 | Android MobclickAgent API | 2026-05-26 |
| https://developer.umeng.com/docs/119267/detail/119508 | iOS UMConfigure API | 2026-05-26 |
| https://developer.umeng.com/docs/119267/detail/119517 | iOS MobClick API | 2026-05-26 |
| https://developer.umeng.com/docs/128606/detail/193879 | Android U-Share 集成 | 2026-05-26 |
| https://developer.umeng.com/docs/128606/detail/193653 | iOS U-Share 集成 | 2026-05-26 |
| https://github.com/umeng/MultiFunctionAndroidMavenDemo-master | Android Maven Demo 源码 | 2026-05-26 |
| https://github.com/umeng/MultiFunctioniOSDemo (beta_7.2.0) | iOS Demo 源码 | 2026-05-26 |
| https://trunk.cocoapods.org/api/v1/pods/UMShare/specs/latest | UMShare 6.11.1 podspec | 2026-05-26 |
| https://trunk.cocoapods.org/api/v1/pods/UMCommon/specs/latest | UMCommon 7.5.10 podspec | 2026-05-26 |
| https://repo1.maven.org/maven2/com/umeng/umsdk/*/maven-metadata.xml | Maven Central 版本 | 2026-05-26 |
| https://developers.weixin.qq.com/doc/oplatform/Mobile_App/Access_Guide/iOS.html | 微信 iOS 接入 | 2026-05-26 |
| https://developers.weixin.qq.com/doc/oplatform/Mobile_App/Access_Guide/Android.html | 微信 Android 接入 | 2026-05-26 |
| https://open.dingtalk.com/document/mobile-app-guide/access | 钉钉 iOS 接入 | 2026-05-26 |
| https://open.dingtalk.com/document/mobile-app-guide/android-sharing-sdk-access-process | 钉钉 Android 接入 | 2026-05-26 |
| https://reactnative.dev/docs/the-new-architecture/turbo-modules-with-swift | RN Swift TurboModule 指南 | 2026-05-26 |
| https://reactnative.dev/docs/turbo-native-modules-ios | RN iOS TurboModule | 2026-05-26 |

---

## 五、对 spec 的影响清单（待修订）

1. **§1.1** `Common` 描述："`preInit + init` 两阶段" → iOS 端只有 init，Android 有两段；统一描述为"用户同意《隐私协议》后调 `Common.init()` 触发数据采集"
2. **§3** 架构："iOS 用 Swift（不再走 Obj-C++）" → 改为 "iOS 用 ObjC++ shim + Swift Adapter（每个 TurboModule 三件套 `.h`+`.mm`+`.swift`）"
3. **§5.3 Analytics**：移除 `reportError`（U-App 9.x 已无此 API；需 U-APM 才有）
4. **§7.1 Android 依赖**：补充显式声明 `wechat-sdk-android` 和 `ddsharesdk`
5. **§7.2 iOS podspec**：用 UMCommon 7.5.10 + UMShare 6.11.1 锁版本；移除 UMAnalytics（不存在的 pod）
6. **§8.4 Android 钉钉 Activity**：从"继承友盟 ABS 基类" → 改为"自己实现 `IDDAPIEventHandler`，必须放在 `<pkg>.ddshare.DDShareActivity`"
7. **§9 初始化流程图**：iOS 分支不画 preInit；Android 分支画 preInit+init
8. **§10 错误码映射**：iOS 用 2008/2009/2003；Android 用 throwable.message 字符串匹配（兜底）
9. **§15 风险**：补 UMShare 6.11.1 EXCLUDED_ARCHS 问题、iOS pod 版本落后问题、`setPlaform` 拼写、`use_frameworks!` 限制
10. **§8 集成方配置**：iOS AppDelegate 加 Universal Link 回调；Android Activity 加 onActivityResult / onDestroy 转发模板
