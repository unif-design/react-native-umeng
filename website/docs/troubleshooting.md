---
sidebar_position: 8
title: 常见问题
description: "@unif/react-native-umeng 排障决策树：分享无回调（取消/失败是 reject 非 resolve）、未挂 ShareSheetHost、init 顺序与无参、模拟器不能真分享需真机，以及 iOS / Android 原生回调注册与完整错误码表。"
---

# 常见问题

按**症状 → 原因 → 解法**排查。多数分享问题集中在「把取消 / 失败当 resolve」「没挂 Host」「init 顺序」「在模拟器上跑」四类。

---

## 症状:分享点了「没回调」/ 取消失败的分支永远进不去 {#no-callback-js}

最常见的误解 —— **`Share.openSheet()` / `shareXxx` 取消、失败时是 reject,不是 resolve**。如果只 `await` 不 try/catch,取消 / 失败会变成未捕获的 rejection,看起来像「没回调」。

```ts
// ❌ Incorrect:取消 / 失败不会 resolve,判别分支永远到不了,还可能抛未捕获错误
const r = await Share.openSheet(payload);
if (r.code === 'cancel') { /* 永远到不了 */ }
```

```ts
// ✅ Correct:try/catch 看 e.code;resolve 的 r.code 必为 'success'
try {
  const r = await Share.openSheet(payload); // r.code === 'success'
} catch (e) {
  if (e instanceof UmengError && e.code === 'E_USER_CANCEL') { /* 取消 */ }
  // E_SHARE_FAILED / E_PLATFORM_NOT_INSTALLED 等见下表
}
```

详见[分享指南 → 取消与失败](./guides/sharing#reject-on-cancel)。

---

## 症状:`openSheet` 立即 reject,message 含 "No &lt;ShareSheetHost /&gt; mounted" {#no-host}

没在 App 根挂 `<ShareSheetHost />`(reject `E_UNKNOWN`)。

```tsx
// ❌ Incorrect:没挂 Host
<ThemeProvider>
  <App />
</ThemeProvider>
```

```tsx
// ✅ Correct:App 根挂一次,且在 GestureHandlerRootView + ThemeProvider 内
<GestureHandlerRootView style={{ flex: 1 }}>
  <ThemeProvider>
    <App />
    <ShareSheetHost />
  </ThemeProvider>
</GestureHandlerRootView>
```

> 若 message 是 "Another ShareSheet is already open",说明**一次只能开一个面板**,前一个还没关。等它 resolve / reject(或取消)后再开。挂载细节见[快速上手](./getting-started/quick-start#mount-host)。

---

## 症状:`Common.init()` reject / 统计不上报 {#init-order}

`init` 前必须先 `preInit`,且 `init` **无参**。

```ts
// ❌ Incorrect:没 preInit 直接 init(reject),或 init 带 config
await Common.init({ appkey: '...' });
```

```ts
// ✅ Correct:config 给 preInit;用户同意后调无参 init
await Common.preInit({ appkey: '...', /* ... */ }); // App 启动
await Common.init();                                 // 用户同意后,无参
```

统计不上报最常见原因:`init` 还没调(用户未同意《隐私协议》)。此时 `Analytics.*` 不会崩溃,但数据不上报。两段式见[隐私合规(PIPL)](./guides/privacy-pipl)。

---

## 症状:模拟器上分享编译失败 / 无法跑起来 / 不能真分享 {#simulator}

✅ **这是预期行为,不是 bug。用真机验证分享。**

- 模拟器没有真微信 / 钉钉,**无法完成回调跳转**,分享链路测不通。
- 友盟 U-Share 在 **Apple Silicon Mac 模拟器**上有 `EXCLUDED_ARCHS=arm64` 限制(旧式 `.framework` 未出 arm64 simulator slice)。这是友盟 SDK 已知限制,**强制清 `EXCLUDED_ARCHS` 反而可能触发 arm64 链接错**。

:::tip 在 CI / 模拟器里测逻辑
不要在模拟器里测真实分享。单元测试用[测试(Mock)](./testing)页的 `jest.mock` 方案,在无原生环境跑通分享流程逻辑。
:::

---

## 症状:Android 后台调 `Share.openSheet()` 报 `E_UNKNOWN`（"No current Activity"） {#no-activity}

✅ **分享 API 依赖前台 Activity,不能在后台 / App 不可见时调。**

Android 在无前台 Activity 时会 reject `E_UNKNOWN`,`message` 为 `No current Activity; cannot invoke share` —— 用 `message` 区分此场景与其它 `E_UNKNOWN`。请在用户有操作的前台场景(如按钮回调)中调用分享。

---

## 症状:分享后回调不跳回 App（原生未注册） {#native-callback}

分享后跳回 App 全靠原生侧 URL Scheme / 回调 Activity。**模板别凭记忆编**,按平台逐项核对:

### iOS

- `Info.plist` 缺 `CFBundleURLTypes` 回调 scheme(微信 = `wx`+appid,钉钉 = `dingoa`+appid),或缺 `LSApplicationQueriesSchemes` 白名单。
- `AppDelegate` 没把 `open url` / `continue userActivity` 转发给桥导出的 `UmengBootstrap`。注意 Swift 侧方法名是 **`handleOpen(_:options:)`**(omit-needless-words),不是 `handleOpenURL`。

逐项见 [iOS 原生配置](./native-setup/ios)。

### Android

- `WXEntryActivity`(超类 `WXCallbackActivity`)/ `DDShareActivity` **必须在宿主包名下** —— 微信 / 钉钉 SDK 通过 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"` 反射查找,放在 library 包里查不到、回调丢失。
- 钉钉 `appId` 在 Activity `onCreate` 写死,要与 JS `preInit({ dingtalkAppId })` 一致。

逐项见 [Android 原生配置](./native-setup/android)。

---

## 错误码速查 {#error-codes}

`UmengError.code` 全量含义:

| `code` | 含义 | 触发场景 | 处理 |
| --- | --- | --- | --- |
| `E_USER_CANCEL` | 用户取消 | 点取消 / 点遮罩 / 平台侧取消 | 通常静默 |
| `E_SHARE_FAILED` | 分享失败 | 未配 URL Scheme、网络错、内容不合规等 | 查 `message`;核对原生回调配置 |
| `E_PLATFORM_NOT_INSTALLED` | 目标 App 未安装 | 微信 / 钉钉未装 | `isInstalled()` 预检,或 `hideUninstalled: true` |
| `E_PLATFORM_NOT_SUPPORTED` | 平台不在白名单 | 传了非 `WECHAT_SESSION` / `DINGTALK` 的值 | 用 `Platform` 枚举值 |
| `E_INVALID_OPTIONS` | 参数缺失 / 非法 | `shareLink` 缺 `title`/`url`、`preInit` 缺 `appkey`、没 `preInit` 就 `init` | 检查必填字段 / 初始化顺序 |
| `E_NOT_INITIALIZED` | 预留错误码 | — | — |
| `E_UNKNOWN` | 未归类错误 | 未挂 Host、面板重入、Android 无前台 Activity、SDK 未知错 | 看 `message` / `nativeError` 区分 |

> `UmengError` 还带 `nativeError` 字段(原始错误)。错误码在 JS 层的判别用法见[分享指南](./guides/sharing#reject-on-cancel)。
