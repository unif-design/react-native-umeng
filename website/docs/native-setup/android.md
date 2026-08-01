---
sidebar_position: 2
title: Android 原生配置
description: "Android 原生接入:宿主提供 WXEntryActivity : WXCallbackActivity 与 DDShareActivity : DingCallBack 两个可编译空类，必须放在最终宿主包名的 .wxapi / .ddshare 下；library Manifest 以 disabled 状态声明组件，授权后的 init 才按平台动态启用。Activity 不硬编码 appId。"
---

# Android 原生配置

分享后能否跳回 App 全靠回调 Activity 的注册。**模板别凭记忆编**，逐项核对本页。

:::info 当前验证边界
Android 源码/static native contract 已核对，仓库已有 bootstrap/callback state machine 与 module JVM tests；本轮没有执行 Android Gradle/JVM，留待具备 SDK 的 CI。真实微信/钉钉回跳和启用 R8 的 minified release 同样尚未验证，因此本页仍要求消费者实际构建与真机验收。
:::

---

## `android/app/src/main/AndroidManifest.xml` {#manifest}

:::tip 不需要写的内容（已自动合并）
- **`<uses-permission>` 与 `<queries>`** —— `@unif/react-native-umeng` 的 library Manifest 已声明 `INTERNET` / `ACCESS_NETWORK_STATE` / `ACCESS_WIFI_STATE` 权限，以及 `<queries>`（`com.tencent.mm` 微信、`com.alibaba.android.rimet` 钉钉）；Android manifest merger 自动合并到宿主。
- **友盟相关 `<meta-data>`** —— appkey 等由 JS [`Common.preInit(config)`](../api/common#preinit) 保存,用户授权后 `Common.init()` 才交给 native。
- **回调 Activity manifest 节点** —— library Manifest 已按 `${applicationId}.wxapi.WXEntryActivity` / `${applicationId}.ddshare.DDShareActivity` 声明为 `android:enabled="false"`;完整授权初始化成功后才动态启用已配置平台。宿主只需提供下面两个 class,无需重复注册节点。
:::

微信 / 钉钉 SDK 按 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"` 反射查找,所以 class **不能放在 library 包或任意自定义路径**。

### FileProvider(由 library 合并) {#fileprovider}

library Manifest 同时声明 `androidx.core.content.FileProvider`,authority 固定为 `${applicationId}.fileprovider`;初始化时 Android bridge 把同一 authority 交给友盟。路径资源只开放 App 自己 external files 下的 `umeng_cache/`:

```xml
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <external-files-path name="umeng_cache" path="umeng_cache/" />
</paths>
```

不要照搬开放整个文件系统的 `root-path`。宿主通常无需重复 provider,但 release 验收要检查 merged Manifest 的 authority、resource 与冲突报告;源码中存在节点不等于合并一定成功。

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

继承友盟提供的 `DingCallBack`,空类即可：

```kotlin
package com.example.app.ddshare

import com.umeng.socialize.media.DingCallBack

class DDShareActivity : DingCallBack()
```

:::warning 不要在 Activity 硬编码 appId
凭据只从 [`Common.preInit(config)`](../api/common#umenginitconfig) 的 JS 快照进入用户授权后的 native 初始化。Activity 只负责 SDK 回调链。
:::

---

## 宿主依赖 — 显式声明钉钉 / 微信 SDK {#sdk-deps}

回调 Activity 落在**宿主包名**下、直接 `import` 钉钉 / 友盟微信 SDK 类,而 `@unif/react-native-umeng` 以 Gradle `implementation` 声明这些 SDK(不向宿主传递编译期依赖)。因此宿主 `app/build.gradle` 需显式声明:

```gradle
// android/app/build.gradle —— 版本对齐 @unif/react-native-umeng 的 android/build.gradle
dependencies {
  implementation "com.umeng.umsdk:share-wx:7.3.7"                   // WXEntryActivity 继承的 WXCallbackActivity
  implementation "com.tencent.mm.opensdk:wechat-sdk-android:6.8.34" // 上者超类链(编译期可见)
  implementation "com.umeng.umsdk:share-dingding:7.3.7"             // DDShareActivity 继承的 DingCallBack
  implementation "com.alibaba.android:ddsharesdk:1.2.2"             // 上者超类链(编译期可见)
}
```

> 仅做钉钉分享:需要 `share-dingding` + `ddsharesdk`;仅做微信:需要 `share-wx` + `wechat-sdk-android`。这些显式声明用于宿主回调源码的 compile classpath;runtime 所需的其余友盟 SDK由 library 提供。

友盟 `7.3.7` AAR 仍引用旧 support class,当前宿主还必须在 `android/gradle.properties` 开启 Jetifier:

```properties
android.enableJetifier=true
```

这是上游 SDK 兼容约束,不是新项目的通用最佳实践。当前组合**不应宣称兼容 AGP 10**;必须在升级 AGP 10 前升级 / 替换仍引用旧 support class 的友盟 AAR,移除 Jetifier,并重新跑 release、merged Manifest 与回调验收。

---

## 用户撤回同意 {#withdraw-consent}

当前公共 API 没有可靠的 vendor 反初始化方法。若业务允许撤回同意,至少要禁用两个 exported 回调组件,再由业务安排**完整进程重启**;仅清 JS 状态不能撤销已加载的 vendor SDK:

```kotlin
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

fun disableUmengCallbackActivities(context: Context) {
  val packageName = context.packageName
  listOf(
    "$packageName.wxapi.WXEntryActivity",
    "$packageName.ddshare.DDShareActivity",
  ).forEach { className ->
    context.packageManager.setComponentEnabledSetting(
      ComponentName(packageName, className),
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      PackageManager.DONT_KILL_APP,
    )
  }
}
```

`DONT_KILL_APP` 只避免在写组件状态的中途被系统终止,**不代表可以免重启继续运行**。本包不会把凭据持久化到下一次冷启动、也不会自动恢复授权初始化；但在当前进程内，JS `configSnapshot`、native 已接受的 config 与已加载 vendor 状态仍然存在。因此不能只清业务授权标记或 JS state 后继续运行，必须提供受控 native 禁用入口并安排完整进程重启。

---

## 宿主 MainActivity {#mainactivity}

:::tip 不需要 override 任何回调
不需要 override `onActivityResult` / `onDestroy` 转发给 `UMShareAPI` —— `UmengShareModule` 实现 `ActivityEventListener` + `LifecycleEventListener`，自动接管 Activity 回调链路，并在 `onHostDestroy` / `invalidate()` 时释放 `UMShareAPI`。
:::

---

## Proguard / R8 {#proguard}

:::info consumer rules 会自动参与合并,但不是运行时保证
`@unif/react-native-umeng` 随 AAR 提供 `android/consumer-rules.pro`,宿主通常无需复制。规则覆盖实际钉钉包 `com.android.dingtalk.share.ddsharemodule.**`、友盟与微信相关类和 `Signature`。

“存在 consumer rules”不能推出“任何 minified release 都不会 crash”。宿主仍必须实际构建启用 minify 的 release,检查合并后的规则,并在真机验证微信 / 钉钉回调;SDK 或 R8/AGP 升级后重新验收。
:::

---

## 平台支持 {#platform-support}

| 配置项 | iOS | Android |
| --- | --- | --- |
| AndroidManifest 回调 Activity | — | ✅ library 自动合并为 disabled |
| `WXEntryActivity.kt` | — | ✅ 必填 |
| `DDShareActivity.kt` | — | ✅ 必填 |
| 宿主 `build.gradle` 声明钉钉/微信 SDK | — | ✅ 必填(**不自动**,见 [#sdk-deps](#sdk-deps)) |
| 权限 / `<queries>` | — | ✅ 自动合并 |
| FileProvider | — | ✅ library 合并;宿主需验 merged Manifest |
| MainActivity override | — | ❌ 不需要 |
| 手工复制 Proguard rules | — | 通常不需要;仍须验 minified release |
| 撤回同意 | — | 禁用回调 Activity + 完整进程重启 |

## 相关 {#related}

- [iOS 原生配置](./ios) —— Info.plist / AppDelegate 转发
- [快速上手](../getting-started/quick-start) —— 完整接入流程
- [常见问题 → 分享无回调](../troubleshooting#native-callback) —— 原生未注册的排障
