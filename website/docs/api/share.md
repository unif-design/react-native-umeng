---
sidebar_position: 2
title: Share
description: "Share API 全量参考：openSheet(payload, options?) 命令式面板（推荐，需挂 ShareSheetHost）+ 直拉 shareText/shareImage/shareLink(options) + isInstalled / listPlatforms。payload type 为 'text'|'image'|'link'；取消与失败一律 reject（E_USER_CANCEL / E_SHARE_FAILED / E_PLATFORM_NOT_INSTALLED），resolve 到手的 ShareResult.code 恒为 'success'。"
---

# Share

分享 API，支持**命令式面板**（推荐）和**直拉单平台**两种模式，目标平台为微信会话 / 钉钉。

## 引用 {#import}

```ts
import { Share } from '@unif/react-native-umeng';
```

| 方法 | 签名 | 返回 |
| --- | --- | --- |
| [`openSheet`](#opensheet) | `openSheet(payload, options?)` | `Promise<ShareResult>` |
| [`shareText`](#sharetext) | `shareText(options: ShareTextOptions)` | `Promise<ShareResult>` |
| [`shareImage`](#shareimage) | `shareImage(options: ShareImageOptions)` | `Promise<ShareResult>` |
| [`shareLink`](#sharelink) | `shareLink(options: ShareLinkOptions)` | `Promise<ShareResult>` |
| [`isInstalled`](#isinstalled) | `isInstalled(platform: Platform)` | `Promise<boolean>` |
| [`listPlatforms`](#listplatforms) | `listPlatforms()` | `Promise<PlatformInfo[]>` |

:::danger 取消 / 失败走 reject，不走 resolve
`openSheet` 与所有 `shareXxx` **只有成功才 resolve**（resolve 到手的 `ShareResult.code` 恒为 `'success'`）；用户取消、分享失败、目标未安装都会**抛 `UmengError`**。永远 `try/catch`，详见[取消与失败的处理](#reject-on-cancel)。
:::

---

## `Share.openSheet(payload, options?)` {#opensheet}

命令式拉起分享面板（**推荐用法**）。需在 App 根挂载 `<ShareSheetHost />`，否则 Promise 立即 reject（`E_UNKNOWN`，message `No <ShareSheetHost /> mounted`）。一次只能开一个面板，重入直接 reject。

```ts
function openSheet(
  payload: ShareSheetPayload,
  options?: ShareSheetOptions
): Promise<ShareResult>;
```

### `ShareSheetPayload` {#sharesheetpayload}

判别联合，`type` 决定其余字段：

```ts
type ShareSheetPayload =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; thumb?: string }
  | { type: 'link'; title: string; url: string; description?: string; thumb?: string };
```

| `type` | 字段 | 必填 | 说明 |
| --- | --- | --- | --- |
| `'text'` | `text: string` | ✅ | 纯文字内容 |
| `'image'` | `image: string` | ✅ | 图片网络 URL(本地路径 / base64 暂不支持) |
|  | `thumb?: string` | — | 缩略图 |
| `'link'` | `title: string` | ✅ | 链接标题 |
|  | `url: string` | ✅ | 链接 URL |
|  | `description?: string` | — | 链接描述 |
|  | `thumb?: string` | — | 缩略图 |

### `ShareSheetOptions` {#sharesheetoptions}

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | `'分享至'` | 面板标题 |
| `cancelText` | `string` | `'取消'` | 取消按钮文案 |
| `subtitles` | `Partial<Record<Platform, string>>` | 见 `PLATFORM_DEFAULT_SUBTITLES` | 各平台副标题覆盖 |
| `hideUninstalled` | `boolean` | `false` | `true` 隐藏未安装平台；默认显示但置灰 |

```tsx
import { Share, UmengError } from '@unif/react-native-umeng';

try {
  const r = await Share.openSheet(
    { type: 'link', title: '问问看', url: 'https://example.com', description: '一句话描述' },
    { title: '分享到', hideUninstalled: true }
  );
  // r.code === 'success'
} catch (e) {
  if (e instanceof UmengError && e.code === 'E_USER_CANCEL') {
    /* 用户取消，通常静默 */
  }
}
```

---

## `Share.shareText(options)` {#sharetext}

直拉单平台分享纯文字，跳过面板。

```ts
function shareText(options: ShareTextOptions): Promise<ShareResult>;
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | `Platform` | ✅ | 目标平台（[`Platform` 枚举](./platform-sharesheethost#platform-enum)） |
| `text` | `string` | ✅ | 文字内容 |

`text` 为空时抛 `E_INVALID_OPTIONS`。

---

## `Share.shareImage(options)` {#shareimage}

直拉单平台分享图片。

```ts
function shareImage(options: ShareImageOptions): Promise<ShareResult>;
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | `Platform` | ✅ | 目标平台 |
| `image` | `string` | ✅ | 图片网络 URL(本地路径 / base64 暂不支持) |
| `thumb` | `string` | — | 缩略图 URL |

`image` 为空时抛 `E_INVALID_OPTIONS`。本地图(截图 / 相册路径 / base64)传不进原生层 —— 需先上传拿到 `https://` URL 再分享。

---

## `Share.shareLink(options)` {#sharelink}

直拉单平台分享图文链接。

```ts
function shareLink(options: ShareLinkOptions): Promise<ShareResult>;
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | `Platform` | ✅ | 目标平台 |
| `title` | `string` | ✅ | 链接标题 |
| `url` | `string` | ✅ | 链接 URL |
| `description` | `string` | — | 链接描述 |
| `thumb` | `string` | — | 缩略图 URL |

`title` 或 `url` 为空时抛 `E_INVALID_OPTIONS`。

---

## `Share.isInstalled(platform)` {#isinstalled}

查询指定平台 App 是否已安装。

```ts
function isInstalled(platform: Platform): Promise<boolean>;
```

> Android 在无前台 Activity 时无法可靠判断，保守返回 `false`。

---

## `Share.listPlatforms()` {#listplatforms}

获取全部支持平台的安装状态列表（按 `SUPPORTED_PLATFORMS` 顺序）。`<ShareSheetHost />` 用它渲染面板的平台条目。

```ts
function listPlatforms(): Promise<PlatformInfo[]>;
```

返回 `PlatformInfo[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `platform` | `Platform` | 平台枚举值 |
| `installed` | `boolean` | 是否已安装 |
| `displayName` | `string` | 平台显示名称（如 `'微信'` / `'钉钉'`） |

---

## 返回值 `ShareResult` {#shareresult}

```ts
interface ShareResult {
  code: 'success' | 'cancel' | 'failed';
  platform: Platform;
  message?: string;
}
```

| `code` | 何时出现 |
| --- | --- |
| `'success'` | 唯一会 **resolve** 的取值 —— resolve 到手的 `ShareResult` 必为它 |
| `'cancel'` / `'failed'` | **不会 resolve** —— JS 层翻成 `UmengError`（见下）抛出，存在于 `ShareResult` 仅为类型完整 |

---

## 取消与失败:reject-on-cancel {#reject-on-cancel}

`openSheet` 与所有 `shareXxx` 把 native 的 `cancel` / `failed` 翻成 `UmengError` **抛出**，只有 `success` 才 resolve：

```ts
// ❌ Incorrect:取消 / 失败不会 resolve，判别分支永远到不了
const r = await Share.openSheet(payload);
if (r.code === 'cancel') { /* 永远到不了 */ }
```

```ts
// ✅ Correct:try/catch 看 e.code;resolve 的 r.code 必为 'success'
try {
  const r = await Share.openSheet(payload); // r.code === 'success'
} catch (e) {
  if (e instanceof UmengError) {
    switch (e.code) {
      case 'E_USER_CANCEL':            /* 用户取消，静默 */ break;
      case 'E_PLATFORM_NOT_INSTALLED': /* 目标 App 未安装 */ break;
      case 'E_SHARE_FAILED':           /* 分享失败，查 e.message */ break;
    }
  }
}
```

可能抛出的 `UmengError.code`：

| `code` | 触发 |
| --- | --- |
| `E_USER_CANCEL` | 用户点取消 / 点遮罩 / 平台侧取消 |
| `E_SHARE_FAILED` | 分享失败（未配 URL Scheme、网络错、内容不合规等） |
| `E_PLATFORM_NOT_INSTALLED` | 目标微信 / 钉钉未安装（面板内点击未安装平台时） |
| `E_PLATFORM_NOT_SUPPORTED` | 传了不在 `SUPPORTED_PLATFORMS` 的平台 |
| `E_INVALID_OPTIONS` | 必填字段缺失（`shareText` 缺 `text`、`shareLink` 缺 `title`/`url` 等） |
| `E_UNKNOWN` | 未挂 Host、面板重入、Android 无前台 Activity、SDK 未知错 |

完整错误码表见[常见问题 → 错误码速查](../troubleshooting#error-codes)。

---

## 平台支持 {#platform-support}

| API | iOS | Android |
| --- | --- | --- |
| `openSheet` | ✅ | ✅ |
| `shareText` / `shareImage` / `shareLink` | ✅ | ✅ |
| `isInstalled` | ✅ | ✅ |
| `listPlatforms` | ✅ | ✅ |

## 相关 {#related}

- [分享指南](../guides/sharing) —— 任务导向用法、payload 类型、坑
- [Platform & ShareSheetHost](./platform-sharesheethost) —— `Platform` 枚举 + 宿主组件挂载
- [常见问题](../troubleshooting#error-codes) —— 错误码速查与分享无回调排障
