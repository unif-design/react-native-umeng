---
sidebar_position: 8
title: 常见问题
description: '@unif/react-native-umeng 排障决策树：分享无回调（取消/失败是 reject 非 resolve）、未挂 ShareSheetHost、init 顺序与无参、模拟器不能真分享需真机，以及 iOS / Android 原生回调注册与完整错误码表。'
---

# 常见问题

按**症状 → 原因 → 解法**排查。多数分享问题集中在「把取消 / 失败当 resolve」「没挂 Host」「init 顺序」「在模拟器上跑」四类。

---

## 症状:分享点了「没回调」/ 取消失败的分支永远进不去 {#no-callback-js}

最常见的误解 —— **`Share.openSheet()` / `shareXxx` 取消、失败时是 reject,不是 resolve**。如果只 `await` 不 try/catch,取消 / 失败会变成未捕获的 rejection,看起来像「没回调」。

```ts
// ❌ Incorrect:取消 / 失败不会 resolve,判别分支永远到不了,还可能抛未捕获错误
const r = await Share.openSheet(payload);
if (r.code === 'cancel') {
  /* 永远到不了 */
}
```

```ts
// ✅ Correct:try/catch 看 e.code;resolve 的 r.code 必为 'success'
try {
  const r = await Share.openSheet(payload); // r.code === 'success'
} catch (e) {
  if (e instanceof UmengError && e.code === 'E_USER_CANCEL') {
    /* 取消 */
  }
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
// ✅ Correct:App 根挂一次并位于 ThemeProvider 内;外层 root 供 App 其它 RNGH UI 使用
<GestureHandlerRootView style={{ flex: 1 }}>
  <ThemeProvider>
    <App />
    <ShareSheetHost />
  </ThemeProvider>
</GestureHandlerRootView>
```

> Host 已在 Modal 内容里创建自己的 `GestureHandlerRootView`;外层 root 不能替代内部边界。若 message 是 `Another ShareSheet is already open`,说明前一个 session 还没结束;若是 `The active <ShareSheetHost /> unmounted...`,说明承载当前 session 的 owner Host 被卸载。两者都使用 `E_UNKNOWN`。

## 症状:从微信 / 钉钉返回后面板消失，页面无法继续操作 {#floating-return}

需要在返回 App 后仍保留取消入口和下层长图滚动时，应使用 `presentation: 'floating'`，并在当前页面内挂载 `<ShareSheetHost />`。浮动面板无遮罩，sharing 期间不会先消失；点击取消会 reject `E_USER_CANCEL`，迟到的原生 callback 会被忽略。

```ts
await Share.openSheet(payload, {
  presentation: 'floating',
  onSheetLayout: (height) => setBottomInset(height),
  onDismiss: () => setSharing(false),
});
```

不要仅根据 `openSheet` 的 Promise 结束就立即拉起下一张面板；若后续动作依赖呈现层已经完全退场，以 `onDismiss` 为准。

---

## 症状:`Common.init()` reject / 统计不上报 {#init-order}

`init` 前必须先 `preInit`,且 `init` **无参**。

```ts
// ❌ Incorrect:没 preInit 直接 init(reject),或 init 带 config
await Common.init({ appkey: '...' });
```

```ts
// ✅ Correct:config 给 preInit;用户同意后调无参 init
await Common.preInit({ appkey: '...' /* ... */ }); // App 启动
await Common.init(); // 用户同意后,无参
```

统计不上报最常见原因:`init` 还没完成(用户未同意《隐私协议》)。Android 与 iOS 的 `Analytics.*` 都会在 init 前同步 no-op,且不会缓存或补发。两段式见[隐私合规(PIPL)](./guides/privacy-pipl)。

---

## 症状:模拟器上分享编译失败 / 无法跑起来 / 不能真分享 {#simulator}

真实微信 / 钉钉分享必须用真机,但**模拟器编译失败不是可以直接忽略的预期结果**。

- 模拟器没有真微信 / 钉钉,**无法完成回调跳转**,分享链路测不通。
- 仓库 iOS simulator Pod/Codegen/build/XCTest 已通过。消费者若编译失败,应核对自己的 Pod 图、New Architecture、Worklets plugin 与原生配置,不能把任意编译错误归因于“模拟器不能真分享”。

:::tip 在 CI / 模拟器里测逻辑
不要在模拟器里测真实分享。单元测试用[测试(Mock)](./testing)页的 `jest.mock` 方案,在无原生环境跑通分享流程逻辑。
:::

---

## 症状:Android 后台调用分享 {#no-activity}

分享 UI 应只由前台用户操作触发,但要区分 `openSheet` 与直拉 API 的当前行为:

- `Share.openSheet()` 先调用 `listPlatforms()`。Android 没有 current Activity 时,`isInstalled` 当前保守 resolve `false`,所以 `openSheet` **不会必然立即抛** `No current Activity`;它可能保持 pending、等 App 回前台显示,或把平台显示为未安装(`hideUninstalled=true` 时为空)。
- `Share.shareText/shareImage/shareLink` 直拉时没有 current Activity,才会 reject `E_UNKNOWN`,message 为 `No current Activity; cannot invoke share`。

不要依赖后台 Modal 或上述降级细节;在前台按钮回调中调用分享。

---

## 症状:分享后回调不跳回 App（原生未注册） {#native-callback}

分享后跳回 App 全靠原生侧 URL Scheme / 回调 Activity。**模板别凭记忆编**,按平台逐项核对:

### iOS

- 仓库已通过 `initialize(config)`、module map/Codegen、AppDelegate/Scene compile fixture 与 XCTest；这些证据不代表消费者的真实 scheme/domain 已配置。
- `Info.plist` 缺 `CFBundleURLTypes`,误在开放平台分配原值之外再拼 `wx` / `dingoa`,或缺 `LSApplicationQueriesSchemes` 白名单。
- AppDelegate / SceneDelegate 对 URL 与 Universal Link 必须**分别调用** Umeng 和 `RCTLinkingManager`,两者都执行后再 OR;不能用短路表达式漏掉第二个 handler。
- Universal Link 还要核对 Associated Domains、无重定向 AASA、`TeamID.BundleID`、path 与 `wechatUniversalLink` host。

逐项见 [iOS 原生配置](./native-setup/ios)。

### Android

- `WXEntryActivity`(超类 `WXCallbackActivity`)/ `DDShareActivity` **必须在宿主包名下** —— 微信 / 钉钉 SDK 通过 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"` 反射查找,放在 library 包里查不到、回调丢失。
- `DDShareActivity` 没有直接继承友盟 `DingCallBack`,或把 appId 硬编码进 Activity。Activity 应为空回调壳,凭据由授权后的 native 初始化读取 JS config 快照。

逐项见 [Android 原生配置](./native-setup/android)。

---

## 错误码速查 {#error-codes}

`UmengError.code` 全量含义:

| `code`                     | 含义            | 触发场景                                                                         | 处理                                            |
| -------------------------- | --------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| `E_USER_CANCEL`            | 用户取消        | 点取消 / 点遮罩 / 平台侧取消                                                     | 通常静默                                        |
| `E_SHARE_FAILED`           | 分享失败        | 未配 URL Scheme、网络错、内容不合规等                                            | 查 `message`;核对原生回调配置                   |
| `E_PLATFORM_NOT_INSTALLED` | 目标 App 未安装 | 微信 / 钉钉未装                                                                  | `isInstalled()` 预检,或 `hideUninstalled: true` |
| `E_PLATFORM_NOT_SUPPORTED` | 平台不在白名单  | 传了非 `WECHAT_SESSION` / `DINGTALK` 的值                                        | 用 `Platform` 枚举值                            |
| `E_INVALID_OPTIONS`        | 参数缺失 / 非法 | `shareLink` 缺 `title`/`url`、`preInit` config 非法或 init 开始后换 config       | 检查必填字段 / config 一致性                    |
| `E_NOT_INITIALIZED`        | 尚未初始化      | 没 `preInit` 就 `init`,或在完成 init 前调用要求初始化的 native API               | 按 `preInit` → 用户同意 → `init` 顺序调用       |
| `E_UNKNOWN`                | 未归类错误      | 未挂 Host、面板重入、owner Host 卸载、直拉时 Android 无前台 Activity、SDK 未知错 | 看 `message` / `nativeError` 区分               |

> `UmengError` 还带 `nativeError` 字段(原始错误)。错误码在 JS 层的判别用法见[分享指南](./guides/sharing#reject-on-cancel)。
