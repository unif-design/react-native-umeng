---
sidebar_position: 2
title: Android 原生配置
description: "Android 原生接入:AndroidManifest 注册两个回调 Activity —— WXEntryActivity（超类 com.umeng.socialize.weixin.view.WXCallbackActivity）与 DDShareActivity（继承 Activity + IDDAPIEventHandler），必须放在宿主包名下（SDK 反射查 getPackageName() + .wxapi.WXEntryActivity / .ddshare.DDShareActivity）。钉钉 appId 在 onCreate 写死、要与 preInit({ dingtalkAppId }) 一致（推荐 BuildConfig.DINGTALK_APPID 单一数据源）。权限 / queries / consumer proguard 由 library Manifest + consumer-rules.pro 自动合并，宿主不用写。钉钉 / 微信 SDK 是 library 的 implementation 依赖（不传递编译期），宿主 build.gradle 需显式声明。"
---

# Android 原生配置

分享后能否跳回 App 全靠回调 Activity 的注册。**模板别凭记忆编**，逐项核对本页。

---

## `android/app/src/main/AndroidManifest.xml` {#manifest}

:::tip 不需要写的内容（已自动合并）
- **`<uses-permission>` 与 `<queries>`** —— `@unif/react-native-umeng` 的 library Manifest 已声明 `INTERNET` / `ACCESS_NETWORK_STATE` / `ACCESS_WIFI_STATE` 权限，以及 `<queries>`（`com.tencent.mm` 微信、`com.alibaba.android.rimet` 钉钉）；Android manifest merger 自动合并到宿主。
- **友盟相关 `<meta-data>`** —— appkey 等通过 JS [`Common.preInit(config)`](../api/common#preinit) 传。
:::

**仅需注册两个回调 Activity**（微信 / 钉钉 SDK 硬限制：必须在宿主包名下，SDK 用 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"` 反射查找，**不能放在 library 包**）：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <!-- 微信回调 Activity(超类见下,一行空类) -->
    <activity
      android:name=".wxapi.WXEntryActivity"
      android:configChanges="keyboardHidden|orientation|screenSize"
      android:exported="true"
      android:theme="@android:style/Theme.Translucent.NoTitleBar"/>

    <!-- 钉钉回调 Activity(必须叫 DDShareActivity;包路径固定) -->
    <activity
      android:name=".ddshare.DDShareActivity"
      android:configChanges="keyboardHidden|orientation|screenSize"
      android:exported="true"
      android:launchMode="singleInstance"
      android:theme="@android:style/Theme.Translucent.NoTitleBar"/>
  </application>
</manifest>
```

---

## 微信回调 — `<appPkg>/wxapi/WXEntryActivity.kt` {#wxentryactivity}

继承友盟提供的基类 `WXCallbackActivity`，空类即可：

```kotlin
package com.example.app.wxapi

import com.umeng.socialize.weixin.view.WXCallbackActivity

class WXEntryActivity : WXCallbackActivity()
```

:::warning 超类是友盟的 `WXCallbackActivity`
超类必须是 `com.umeng.socialize.weixin.view.WXCallbackActivity`（友盟封装了微信 `IWXAPIEventHandler` 的回调链路），**不是**微信原生的 `WXEntryActivity`。包路径必须是 `<宿主包名>.wxapi.WXEntryActivity`。
:::

---

## 钉钉回调 — `<appPkg>/ddshare/DDShareActivity.kt` {#ddshareactivity}

继承 `Activity` 并实现 `IDDAPIEventHandler`：

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
    // 官方 Android 接入的固有形态。为避免两处写死漂移,用构建时单一数据源
    // BuildConfig.DINGTALK_APPID(定义见下)。
    val appId = BuildConfig.DINGTALK_APPID
    iddShareApi = DDShareApiFactory.createDDShareApi(this, appId, false)
    iddShareApi.handleIntent(intent, this)
  }

  override fun onReq(req: BaseReq) {}
  override fun onResp(resp: BaseResp) {
    // 友盟钉钉回调由 SDK 内部 hook,此处 finish 即可
    finish()
  }
}
```

:::warning appId 必须与 JS `preInit({ dingtalkAppId })` 一致
钉钉 appId 在 `DDShareActivity.onCreate` 传入，同一个值也要传给 JS [`Common.preInit({ dingtalkAppId })`](../api/common#umenginitconfig)。推荐用 `BuildConfig.DINGTALK_APPID` 作为单一数据源，避免两处写死漂移。
:::

**`BuildConfig` 单一数据源（推荐）：**

```gradle
// android/app/build.gradle
android {
  defaultConfig {
    buildConfigField "String", "DINGTALK_APPID", "\"dingoaXXXXXXXX\""
  }
  buildFeatures { buildConfig = true }   // AGP 8+ 默认关,需显式开
}
```

---

## 宿主依赖 — 显式声明钉钉 / 微信 SDK {#sdk-deps}

回调 Activity 落在**宿主包名**下、直接 `import` 钉钉 / 友盟微信 SDK 类,而 `@unif/react-native-umeng` 以 Gradle `implementation` 声明这些 SDK(不向宿主传递编译期依赖)。因此宿主 `app/build.gradle` 需显式声明:

```gradle
// android/app/build.gradle —— 版本对齐 @unif/react-native-umeng 的 android/build.gradle
dependencies {
  implementation "com.alibaba.android:ddsharesdk:1.2.2"             // DDShareActivity import 的钉钉 SDK
  implementation "com.umeng.umsdk:share-wx:7.3.7"                   // WXEntryActivity 继承的 WXCallbackActivity
  implementation "com.tencent.mm.opensdk:wechat-sdk-android:6.8.34" // 上者超类链(编译期可见)
}
```

> 仅做钉钉分享:只需 `ddsharesdk`;仅做微信:只需 `share-wx` + `wechat-sdk-android`。runtime 所需的其余友盟 SDK(`common` / `asms` / `share-core` / `share-dingding`)由 library 的 `implementation` 经 runtime classpath 提供,宿主不用重复。

---

## 宿主 MainActivity {#mainactivity}

:::tip 不需要 override 任何回调
不需要 override `onActivityResult` / `onDestroy` 转发给 `UMShareAPI` —— `UmengShareModule` 实现 `ActivityEventListener` + `LifecycleEventListener`，自动接管 Activity 回调链路，并在 `onHostDestroy` / `invalidate()` 时释放 `UMShareAPI`。
:::

---

## Proguard / R8 {#proguard}

:::tip 不需要写 Proguard 规则
`@unif/react-native-umeng` 通过 `android/consumer-rules.pro` 自动给宿主 App 合并 R8 / proguard 规则（保留友盟 / 微信 / 钉钉相关 class 不被混淆）。release build 直接 `./gradlew assembleRelease`，不会因混淆 crash。
:::

---

## 平台支持 {#platform-support}

| 配置项 | iOS | Android |
| --- | --- | --- |
| AndroidManifest 回调 Activity | — | ✅ 必填 |
| `WXEntryActivity.kt` | — | ✅ 必填 |
| `DDShareActivity.kt` | — | ✅ 必填 |
| 宿主 `build.gradle` 声明钉钉/微信 SDK | — | ✅ 必填(**不自动**,见 [#sdk-deps](#sdk-deps)) |
| 权限 / `<queries>` | — | ✅ 自动合并 |
| MainActivity override | — | ❌ 不需要 |
| Proguard rules | — | ❌ 不需要（自动合并） |

## 相关 {#related}

- [iOS 原生配置](./ios) —— Info.plist / AppDelegate 转发
- [快速上手](../getting-started/quick-start) —— 完整接入流程
- [常见问题 → 分享无回调](../troubleshooting#native-callback) —— 原生未注册的排障
