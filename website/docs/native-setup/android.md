---
sidebar_position: 2
title: Android 原生配置
description: AndroidManifest 回调 Activity、WXEntryActivity、DDShareActivity BuildConfig 单一数据源、MainActivity 说明。
---

# Android 原生配置

## `android/app/src/main/AndroidManifest.xml`

:::tip 不需要写的内容
- `<uses-permission>` 和 `<queries>` — `@unif/react-native-umeng` 的 library Manifest 已经声明，Android manifest merger 自动合并到宿主。
- 友盟相关 `<meta-data>` — appkey 等通过 JS `Common.preInit(config)` 传。
:::

**仅需注册两个回调 Activity**（微信/钉钉 SDK 硬限制：必须在宿主包名下，SDK 用 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"` 反射查找，不能放在 library 包）：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <!-- 微信回调 Activity（友盟提供基类，一行空类，见下） -->
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

---

## 微信回调 — `<appPkg>/wxapi/WXEntryActivity.kt`

```kotlin
package com.example.app.wxapi

import com.umeng.socialize.weixin.view.WXCallbackActivity

class WXEntryActivity : WXCallbackActivity()
```

---

## 钉钉回调 — `<appPkg>/ddshare/DDShareActivity.kt`

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
    // 钉钉 SDK 要求 Activity onCreate 时就传 appId 建 ShareApi 实例，且冷启动可能直接
    // 拉起本 Activity（JS 还没跑），所以只能 native 侧拿、读不到 JS config —— 这是钉钉
    // 官方 Android 接入的固有形态（官方示例也是 onCreate 传常量）。为避免两处写死漂移，
    // 用构建时单一数据源 BuildConfig.DINGTALK_APPID（定义见下）。
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

:::warning appId 必须与 JS `Common.preInit({ dingtalkAppId })` 一致
钉钉 appId 在 `DDShareActivity.onCreate` 中传入，同一个值也要传给 JS 的 `Common.preInit({ dingtalkAppId })`。推荐用 `BuildConfig.DINGTALK_APPID` 作为单一数据源，避免两处写死漂移。
:::

**BuildConfig 单一数据源（推荐）：**

```gradle
// android/app/build.gradle
android {
  defaultConfig {
    buildConfigField "String", "DINGTALK_APPID", "\"dingoaXXXXXXXX\""
  }
  buildFeatures { buildConfig = true }   // AGP 8+ 默认关，需显式开
}
```

---

## 宿主 MainActivity

:::tip 不需要 override 的内容
不需要 override `onActivityResult` 或 `onDestroy` 转发给 `UMShareAPI` — `UmengShareModule` 实现 `ActivityEventListener`，会自动接管 Activity 回调链路，并在 `invalidate()` 时释放 `UMShareAPI`。
:::

---

## Proguard

:::tip 不需要写 Proguard 规则
`@unif/react-native-umeng` 通过 `android/consumer-rules.pro` 自动给宿主 App 合并 R8/proguard 规则（保留友盟 / 微信 / 钉钉相关 class 不被混淆）。release build 直接跑 `./gradlew assembleRelease` 不会因为混淆 crash。
:::

---

## 平台支持

| 配置项 | iOS | Android |
| --- | --- | --- |
| AndroidManifest 回调 Activity | — | ✅ 必填 |
| WXEntryActivity.kt | — | ✅ 必填 |
| DDShareActivity.kt | — | ✅ 必填 |
| MainActivity override | — | ❌ 不需要 |
| Proguard rules | — | ❌ 不需要（自动合并） |

## 相关

- [iOS 原生配置](./ios)
- [快速上手](../getting-started/quick-start)
