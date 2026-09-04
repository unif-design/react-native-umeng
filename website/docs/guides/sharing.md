---
sidebar_position: 1
title: 分享
description: "用 @unif/react-native-umeng 分享到微信会话 / 钉钉：命令式 Share.openSheet(payload) 拉面板或直拉 shareText/shareImage/shareLink，payload type 为 'text'|'image'|'link'；取消与失败 reject（E_USER_CANCEL / E_SHARE_FAILED），resolve 的 r.code 恒为 success。"
---

# 分享

本页介绍如何用 `@unif/react-native-umeng` 把内容分享到**微信会话**或**钉钉** —— 命令式分享面板、直拉单平台、三种内容类型,以及取消 / 失败的正确处理。

:::info 首版只支持微信会话 + 钉钉
`Platform` 枚举只有 `WECHAT_SESSION`(微信会话)与 `DINGTALK`(钉钉)。**没有朋友圈 / QQ / 微博**;传未支持的平台会抛 `E_PLATFORM_NOT_SUPPORTED`。
:::

---

## 命令式面板(推荐) {#open-sheet}

`Share.openSheet(payload, options?)` 拉起 design 组件组成的分享面板；默认使用 RN `Modal`，也可嵌入当前页面作为无遮罩浮层:

```tsx
import { Share, UmengError } from '@unif/react-native-umeng';

async function onShareTap() {
  try {
    const r = await Share.openSheet({
      type: 'link',
      title: '问问看',
      url: 'https://example.com',
      description: '一句话描述',
    });
    // 成功:r = { code: 'success', platform: 'wechat_session' | 'dingtalk', message? }
  } catch (e) {
    if (e instanceof UmengError && e.code === 'E_USER_CANCEL') {
      // 用户取消,通常静默
    }
    // 其它兜底见下「取消与失败」
  }
}
```

面板的外观文案可用第二参 `options` 覆盖:

| 字段              | 类型                                | 默认       | 说明                                                |
| ----------------- | ----------------------------------- | ---------- | --------------------------------------------------- |
| `title`           | `string`                            | `'分享至'` | 面板标题                                            |
| `cancelText`      | `string`                            | `'取消'`   | 取消按钮文案                                        |
| `subtitles`       | `Partial<Record<Platform, string>>` | 内置       | 各平台副标题覆盖                                    |
| `hideUninstalled` | `boolean`                           | `false`    | `true` 完全隐藏未安装平台；`false` 时仍显示且可点击 |
| `presentation`    | `'modal' \| 'floating'`             | `'modal'`  | 浮层模式无遮罩，面板外触摸穿透给当前页面            |
| `onSheetLayout`   | `(height: number) => void`          | —          | 回传面板高度，供下层滚动内容预留空间                |
| `onDismiss`       | `() => void`                        | —          | 呈现层完全退场或早期打开失败时回调一次              |

`hideUninstalled=false` 时，点击未安装的平台不会调用 native share；`openSheet`
返回的 Promise 会 reject `UmengError`，code 为
`E_PLATFORM_NOT_INSTALLED`。只有 `hideUninstalled=true` 才会完全隐藏未安装平台。

> 必须先挂载 `<ShareSheetHost />`,否则 `openSheet` 立即 reject。多个 Host 中最新挂载者承载新 session；因此 `floating` 可以在需要覆盖的页面内就近挂 Host。挂载方式见[快速上手](../getting-started/quick-start#mount-host)。

面板打开前会先加载平台安装状态。该查询失败(包括尚未 `Common.init()`)时,Promise 直接 reject且不显示 Modal;承载本 session 的 owner Host 卸载也会以 `E_UNKNOWN` 结束 Promise,不会永久 pending。

一次只能有一个 session，且前一呈现层完全退场前重入会以 busy 错误 reject。`floating` 在 sharing 期间保留取消按钮；用户取消后旧平台 callback 即使迟到也不会误结算下一次分享。

```tsx
<View style={{ flex: 1 }}>
  <ScrollablePreview />
  <ShareSheetHost />
</View>;

await Share.openSheet(
  { type: 'image', image: remoteImageUrl },
  {
    presentation: 'floating',
    onSheetLayout: (height) => setBottomInset(height),
    onDismiss: () => setShareVisible(false),
  }
);
```

---

## 直拉单平台(跳过面板) {#share-xxx}

不需要面板、想直接发到某个平台时,用 `shareText` / `shareImage` / `shareLink`。它们与面板共用同一套逻辑,但需显式传 `platform`:

```tsx
import { Share, Platform } from '@unif/react-native-umeng';

// 链接
await Share.shareLink({
  platform: Platform.WECHAT_SESSION,
  title: '标题',
  url: 'https://example.com',
  description: '描述', // 可选
  thumb: 'https://example.com/thumb.png', // 可选
});

// 纯文本
await Share.shareText({ platform: Platform.DINGTALK, text: '纯文字内容' });

// 图片
await Share.shareImage({
  platform: Platform.WECHAT_SESSION,
  image: 'https://example.com/pic.png',
  thumb: 'https://example.com/thumb.png', // 可选
});
```

> 直拉变体同样**取消 / 失败 reject、成功 resolve**(见下)。想先判断目标 App 是否安装,用 `await Share.isInstalled(Platform.WECHAT_SESSION)`。

---

## 三种内容类型 {#payload-types}

`openSheet` 的 `payload` 是一个判别联合,`type` 取 `'text' | 'image' | 'link'`:

| `type`    | 字段                                     | 说明                                                         |
| --------- | ---------------------------------------- | ------------------------------------------------------------ |
| `'text'`  | `text`                                   | 纯文本                                                       |
| `'image'` | `image`、`thumb?`                        | 图片(**仅网络 URL**;本地路径 / base64 传不进原生层,暂不支持) |
| `'link'`  | `title`、`url`、`description?`、`thumb?` | 图文链接                                                     |

直拉变体一一对应:`shareText({ platform, text })`、`shareImage({ platform, image, thumb? })`、`shareLink({ platform, title, url, description?, thumb? })`。完整参数表见 [Share API](../api/share)。

---

## 取消与失败:走 reject,不走 resolve {#reject-on-cancel}

这是最容易踩的坑。`openSheet` 与所有 `shareXxx` **只有成功才 resolve**(resolve 到手的 `r.code` 恒为 `'success'`);用户取消、分享失败、目标未安装都会**抛 `UmengError`**:

```ts
// ❌ Incorrect:取消 / 失败不会 resolve,这样永远判不到
const r = await Share.openSheet(payload);
if (r.code === 'cancel') {
  /* 永远到不了 */
}
if (r.code === 'failed') {
  /* 永远到不了 */
}
```

```ts
// ✅ Correct:try/catch 看 e.code;resolve 的 r.code 必为 'success'
import { Share, UmengError } from '@unif/react-native-umeng';

try {
  const r = await Share.openSheet(payload);
  // r.code === 'success'
} catch (e) {
  if (e instanceof UmengError) {
    switch (e.code) {
      case 'E_USER_CANCEL':
        /* 用户取消,静默 */ break;
      case 'E_PLATFORM_NOT_INSTALLED':
        /* 目标 App 未安装 */ break;
      case 'E_SHARE_FAILED':
        /* 分享失败,查 e.message */ break;
      // 其它见下表
    }
  }
}
```

可能抛出的 `UmengError.code`:

| `code`                     | 触发                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `E_USER_CANCEL`            | 用户点取消 / 点遮罩 / 平台侧取消                                   |
| `E_SHARE_FAILED`           | 分享失败(未配 URL Scheme、网络错、内容不合规等)                    |
| `E_PLATFORM_NOT_INSTALLED` | 目标微信 / 钉钉未安装                                              |
| `E_PLATFORM_NOT_SUPPORTED` | 传了不在白名单的平台                                               |
| `E_INVALID_OPTIONS`        | 必填字段缺失(如 `shareLink` 缺 `title` / `url`)                    |
| `E_NOT_INITIALIZED`        | 尚未完成 `Common.init()` 就查询平台或发起分享                      |
| `E_UNKNOWN`                | 未挂 Host、面板重入、owner Host 卸载、平台查询失败或无法归类的错误 |

完整错误码与排障见[常见问题](../troubleshooting)。

---

## 易错点(Incorrect / Correct) {#gotchas}

### 1. 没挂 `<ShareSheetHost />` {#no-host}

```tsx
// ❌ Incorrect:没挂 Host,openSheet 立即 reject(E_UNKNOWN: "No <ShareSheetHost /> mounted")
<ThemeProvider>
  <App />
</ThemeProvider>
```

```tsx
// ✅ Correct:App 根挂一次并位于 ThemeProvider 内
<ThemeProvider>
  <App />
  <ShareSheetHost />
</ThemeProvider>
```

Host 会在 RN `Modal` 内容内自行包 `GestureHandlerRootView`;App 外层 root 不能替代这个独立 native root 内的边界,也不是 Host 生效的硬前提。完整挂载关系见[快速上手](../getting-started/quick-start#mount-host)。

### 2. 把 umeng 的 `Platform` 当成 React Native 的 {#platform-confusion}

umeng 的 `Platform` 是**分享目标枚举**(`wechat_session` / `dingtalk`),**不是** `react-native` 的 `Platform`,它**没有 `.OS`**:

```ts
// ❌ Incorrect:这不是 react-native 的 Platform
import { Platform } from '@unif/react-native-umeng';
if (Platform.OS === 'ios') {
} // 没有 .OS
```

```ts
// ✅ Correct:判 OS 用 RN 的;分享目标用 umeng 的,混用时起别名
import { Platform } from 'react-native'; // OS 判断
import { Platform as ShareTarget } from '@unif/react-native-umeng'; // 分享目标
if (Platform.OS === 'ios') {
  /* ... */
}
await Share.shareText({ platform: ShareTarget.WECHAT_SESSION, text: '…' });
```

---

## 相关

- [Share API](../api/share) —— 全量 `options` 参数表与返回类型
- [Platform & ShareSheetHost](../api/platform-sharesheethost) —— `Platform` 枚举 + `ShareSheetHost`
- [常见问题](../troubleshooting) —— 分享无回调 / 错误码 / 真机限制
