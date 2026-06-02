---
sidebar_position: 7
title: 测试 / Mocking
description: jest mock 替换 @unif/react-native-umeng 原生绑定，避免 native 模块加载崩溃。
---

# 测试 / Mocking

宿主 App 用 jest 测试自己代码时，`@unif/react-native-umeng` 的 native 绑定在 jest 环境加载会崩。库提供了开箱即用 mock，一行替换：

```ts
// jest setup 或单个测试文件
jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'));
```

## Mock 行为

| 模块 | Mock 行为 |
| --- | --- |
| `Common.preInit` | `jest.fn()`，默认 `Promise.resolve()` |
| `Common.init` | `jest.fn()`，默认 `Promise.resolve()` |
| `Common.isInited` | `jest.fn()`，默认 `Promise.resolve(false)` |
| `Share.shareText` | `jest.fn()`，默认 resolve `{ code: 'success', platform }` |
| `Share.shareImage` | `jest.fn()`，默认 resolve `{ code: 'success', platform }` |
| `Share.shareLink` | `jest.fn()`，默认 resolve `{ code: 'success', platform }` |
| `Share.openSheet` | `jest.fn()`，默认 resolve `{ code: 'success', platform: Platform.WECHAT_SESSION }` |
| `Share.isInstalled` | `jest.fn()`，默认 `Promise.resolve(true)` |
| `Share.listPlatforms` | `jest.fn()`，默认 resolve 全平台 `installed: true` |
| `Analytics.onEvent` | `jest.fn()`（同步 void） |
| `Analytics.signIn` | `jest.fn()`（同步 void） |
| `Analytics.signOut` | `jest.fn()`（同步 void） |
| `ShareSheetHost` | 渲染 `null` |
| `Platform` / `UmengError` | 真实值（不 mock） |

## 结果助手

mock 额外导出 `shareSuccess` / `shareCancel` / `shareFailed` 助手，方便按需覆盖单次返回：

```ts
import { Share, Platform } from '@unif/react-native-umeng';
import { shareCancel, shareFailed } from '@unif/react-native-umeng/mock';

// 覆盖单次返回：模拟用户取消
(Share.shareText as jest.Mock).mockResolvedValueOnce(
  shareCancel(Platform.WECHAT_SESSION)
);

// 覆盖单次返回：模拟分享失败
(Share.openSheet as jest.Mock).mockResolvedValueOnce(
  shareFailed(Platform.DINGTALK, '网络错误')
);
```

### 助手签名

```ts
shareSuccess(platform: Platform): ShareResult
shareCancel(platform: Platform): ShareResult
shareFailed(platform: Platform, message?: string): ShareResult
```
