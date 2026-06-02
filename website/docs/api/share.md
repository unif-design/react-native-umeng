---
sidebar_position: 2
title: Share
description: openSheet / shareLink / shareText / shareImage / isInstalled / listPlatforms — 分享 API 完整参考。
---

# Share

分享 API，支持命令式面板和直拉单平台两种模式。

## 引用

```ts
import { Share } from '@unif/react-native-umeng';
```

---

## `Share.openSheet(payload, options?)`

命令式拉起分享面板（推荐用法）。需根组件挂载 `<ShareSheetHost />`，否则 Promise 立即 reject。

```ts
Share.openSheet(
  payload: ShareSheetPayload,
  options?: ShareSheetOptions
): Promise<ShareResult>
```

### `ShareSheetPayload`

```ts
type ShareSheetPayload =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; thumb?: string }
  | { type: 'link'; title: string; url: string; description?: string; thumb?: string }
```

| `type` | 字段 | 说明 |
| --- | --- | --- |
| `'text'` | `text: string` | 纯文字内容 |
| `'image'` | `image: string` | 图片 URL 或本地路径；`thumb?: string` 缩略图 |
| `'link'` | `title: string`，`url: string` | 链接分享；`description?: string`，`thumb?: string` 可选 |

### `ShareSheetOptions`

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `title` | `string?` | `'分享至'` | 面板标题 |
| `cancelText` | `string?` | `'取消'` | 取消按钮文案 |
| `subtitles` | `Partial<Record<Platform, string>>?` | 见 `PLATFORM_DEFAULT_SUBTITLES` | 各平台副标题覆盖 |
| `hideUninstalled` | `boolean?` | `false` | `true` 时隐藏未安装平台；默认置灰但显示 |

---

## `Share.shareLink(options)`

直拉单平台分享链接，跳过面板。

```ts
Share.shareLink(options: ShareLinkOptions): Promise<ShareResult>
```

### `ShareLinkOptions`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | `Platform` | ✅ | 目标平台 |
| `title` | `string` | ✅ | 链接标题 |
| `url` | `string` | ✅ | 链接 URL |
| `description` | `string?` | — | 链接描述 |
| `thumb` | `string?` | — | 缩略图 URL |

---

## `Share.shareText(options)`

直拉单平台分享纯文字。

```ts
Share.shareText(options: ShareTextOptions): Promise<ShareResult>
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | `Platform` | ✅ | 目标平台 |
| `text` | `string` | ✅ | 文字内容 |

---

## `Share.shareImage(options)`

直拉单平台分享图片。

```ts
Share.shareImage(options: ShareImageOptions): Promise<ShareResult>
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | `Platform` | ✅ | 目标平台 |
| `image` | `string` | ✅ | 图片 URL 或本地路径 |
| `thumb` | `string?` | — | 缩略图 URL |

---

## `Share.isInstalled(platform)`

查询指定平台是否已安装。

```ts
Share.isInstalled(platform: Platform): Promise<boolean>
```

---

## `Share.listPlatforms()`

获取全部支持平台的安装状态列表。

```ts
Share.listPlatforms(): Promise<PlatformInfo[]>
```

返回 `PlatformInfo[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `platform` | `Platform` | 平台枚举值 |
| `installed` | `boolean` | 是否已安装 |
| `displayName` | `string` | 平台显示名称 |

---

## 返回值 `ShareResult`

```ts
interface ShareResult {
  code: 'success' | 'cancel' | 'failed';
  platform: Platform;
  message?: string;
}
```

| `code` | 含义 | 处理建议 |
| --- | --- | --- |
| `'success'` | 分享成功 | — |
| `'cancel'` | 用户取消 | 通常忽略 |
| `'failed'` | 分享失败 | 查看 `message`，链接[错误码](../troubleshooting) |

---

## 平台支持

| API | iOS | Android |
| --- | --- | --- |
| `openSheet` | ✅ | ✅ |
| `shareLink` | ✅ | ✅ |
| `shareText` | ✅ | ✅ |
| `shareImage` | ✅ | ✅ |
| `isInstalled` | ✅ | ✅ |
| `listPlatforms` | ✅ | ✅ |

## 相关

- [分享指南](../guides/sharing)
- [Platform & ShareSheetHost](./platform-sharesheethost)
- [错误码](../troubleshooting)
