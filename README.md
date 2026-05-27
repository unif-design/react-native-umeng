# @unif/react-native-umeng

友盟 React Native bridge：U-Share（微信会话 / 钉钉）+ U-App 移动统计。Unif 私有。

📖 **文档站**：[unif-design.github.io/react-native-umeng](https://unif-design.github.io/react-native-umeng/)
📦 **npm**：[@unif/react-native-umeng](https://www.npmjs.com/package/@unif/react-native-umeng)

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

// 1. 用户同意《隐私协议》后，启动数据采集
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

```xml
<key>UMENG_APPKEY</key>
<string>YOUR_UMENG_APPKEY</string>
<key>UMENG_CHANNEL</key>
<string>App Store</string>

<key>UMENG_WECHAT_APPID</key>
<string>wxXXXXXXXX</string>
<key>UMENG_WECHAT_APPSECRET</key>
<string>XXXXXXXX</string>
<key>UMENG_WECHAT_UNIVERSAL_LINK</key>
<string>https://your.host/path/</string>

<key>UMENG_DINGTALK_APPID</key>
<string>dingoaXXXXXXXX</string>

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
// UmengBootstrap 是 @unif/react-native-umeng 桥导出的 Swift class
// 由桥 Pod 的 modular header 自动暴露，无需 bridging header

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ app: UIApplication, open url: URL,
                   options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return UmengBootstrap.shared.handleOpen(url, options: options)
  }

  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return UmengBootstrap.shared.handleUniversalLink(userActivity)
  }
}
```

#### `ios/Podfile`

```ruby
use_frameworks! :linkage => :static
use_modular_headers!

target 'YourApp' do
  config = use_native_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
    # 清掉 UMShare 6.11.1 的 EXCLUDED_ARCHS=arm64 simulator，让 Apple Silicon Mac 模拟器跑起来
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('UM')
        target.build_configurations.each do |config|
          config.build_settings.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
        end
      end
    end
  end
end
```

#### 微信 Universal Link

微信 SDK 1.8.6+ 强制 UL：到 Apple Developer 启用 Associated Domains，部署 `apple-app-site-association`，Entitlements 加 `applinks:your.host`。详见微信开放平台文档。

### Android

#### `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>

  <!-- Android 11+ 包可见性 -->
  <queries>
    <package android:name="com.tencent.mm"/>
    <package android:name="com.alibaba.android.rimet"/>
  </queries>

  <application>
    <meta-data android:name="UMENG_APPKEY" android:value="@string/umeng_appkey"/>
    <meta-data android:name="UMENG_CHANNEL" android:value="default"/>
    <meta-data android:name="UMENG_WECHAT_APPID" android:value="@string/wechat_appid"/>
    <meta-data android:name="UMENG_WECHAT_APPSECRET" android:value="@string/wechat_appsecret"/>
    <meta-data android:name="UMENG_DINGTALK_APPID" android:value="@string/dingtalk_appid"/>

    <!-- 微信回调 Activity（友盟提供基类，一行空类） -->
    <activity
      android:name=".wxapi.WXEntryActivity"
      android:configChanges="keyboardHidden|orientation|screenSize"
      android:exported="true"
      android:theme="@android:style/Theme.Translucent.NoTitleBar"/>

    <!-- 钉钉回调 Activity（必须叫 DDShareActivity；包路径固定） -->
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
import com.android.dingtalk.share.ddsharemodule.DDShareApiFactory
import com.android.dingtalk.share.ddsharemodule.IDDAPIEventHandler
import com.android.dingtalk.share.ddsharemodule.IDDShareApi
import com.android.dingtalk.share.ddsharemodule.message.BaseReq
import com.android.dingtalk.share.ddsharemodule.message.BaseResp

class DDShareActivity : Activity(), IDDAPIEventHandler {
  private lateinit var iddShareApi: IDDShareApi

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val appId = packageManager
      .getApplicationInfo(packageName, android.content.pm.PackageManager.GET_META_DATA)
      .metaData.getString("UMENG_DINGTALK_APPID") ?: ""
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

#### 宿主 MainActivity — onActivityResult / onDestroy 转发

```kotlin
class MainActivity : ReactActivity() {
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    com.umeng.socialize.UMShareAPI.get(this).onActivityResult(requestCode, resultCode, data)
  }

  override fun onDestroy() {
    super.onDestroy()
    com.umeng.socialize.UMShareAPI.get(this).release()
  }
}
```

#### Proguard `app/proguard-rules.pro`

```pro
-dontwarn com.umeng.**
-keepattributes *Annotation*

-keep class com.umeng.** { *; }
-keep class com.uyumao.** { *; }
-keep class com.uc.** { *; }
-keep class com.ut.** { *; }
-keep class com.ta.** { *; }

-keep class com.tencent.mm.opensdk.** { *; }
-keep class com.tencent.wxop.** { *; }
-keep class com.tencent.mm.sdk.** { *; }
-keep class com.alibaba.android.** { *; }

-keep public class **.R$* { public static final int *; }
-keepclassmembers class * { public <init> (org.json.JSONObject); }
-keepclassmembers enum * {
  public static **[] values();
  public static ** valueOf(java.lang.String);
}
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
| `E_UNKNOWN` | 其它 |

## PIPL 合规

- **Android**：模块构造时自动 `UMConfigure.preInit`（不采集、不上报）；JS `Common.init()` 后才正式启动数据采集
- **iOS**：友盟 iOS SDK 无 preInit；JS `Common.init()` 之前桥不调任何友盟 API。请保证 `Common.init()` 在用户同意《隐私协议》之后调用

## License

MIT
