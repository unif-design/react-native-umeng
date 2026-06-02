---
sidebar_position: 1
title: 分享
description: 命令式 ShareSheet 面板与直拉单平台分享的用法指南。
---

# 分享

## 命令式面板（推荐）

`Share.openSheet()` 拉起 BottomSheet 分享面板，用户选择平台后 Promise resolve 结果：

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
    // r = { code: 'success', platform: 'wechat_session', message?: string }
  } catch (e) {
    if (e instanceof UmengError && e.code === 'E_USER_CANCEL') {
      // 用户点了取消
    }
  }
}
```

返回值 `{ code, platform, message? }` 说明见 [Share API](../api/share)。

## ShareSheetHost 根挂

`Share.openSheet()` 依赖根组件的 `<ShareSheetHost />`。未挂载时 Promise 立即 reject。根挂配置详见[快速上手](../getting-started/quick-start)。

## 直拉单平台

不需要面板、直接调起单一平台：

```tsx
import { Share, Platform } from '@unif/react-native-umeng';

await Share.shareLink({
  platform: Platform.WECHAT_SESSION,
  title: '标题',
  url: 'https://example.com',
  description: '描述',
});

await Share.shareText({
  platform: Platform.DINGTALK,
  text: '纯文字内容',
});
```

## 返回结果

```ts
// { code: 'success' | 'cancel' | 'failed', platform: Platform, message?: string }
```

| `code` | 含义 |
| --- | --- |
| `'success'` | 分享成功 |
| `'cancel'` | 用户取消 |
| `'failed'` | 分享失败（含未配 URL Scheme / 网络错等） |

错误码完整说明见[常见问题 → 错误码](../troubleshooting)。

## 相关

- [Share API](../api/share) — 全量 options 参数表
- [Platform & ShareSheetHost](../api/platform-sharesheethost) — Platform 枚举 + ShareSheetHost
