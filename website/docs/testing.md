---
sidebar_position: 7
title: 测试（Mock）
description: "在 Jest 中用官方 mock 替换 @unif/react-native-umeng：require('@unif/react-native-umeng/mock')，share* 默认 resolve success，Analytics.* 是同步 jest.fn，ShareSheetHost 渲染 null，类型 / 常量 / UmengError 保留真实实现；用 shareCancel / shareFailed + mockResolvedValueOnce 覆盖单次。"
---

# 测试（Mock）

本库依赖 `NativeUmeng*` TurboModule 与 `@unif/react-native-design`,在 Jest 环境直接加载会崩溃。官方随包提供整包 mock,在测试里一行替换即可。

---

## 启用 mock {#enable}

在 Jest setup 或单个测试文件里整包替换:

```ts
jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);
```

替换后:

- **`Share.*` 默认走 happy-path** —— `shareText` / `shareImage` / `shareLink` / `openSheet` 默认 **resolve 成功**(`{ code: 'success', platform }`)。`isInstalled` 默认 `true`,`listPlatforms` 默认全平台已安装。
- **`Analytics.*` 是同步 `jest.fn()`** —— `onEvent` / `signIn` / `signOut` 与真实实现一致(同步 `void`)。
- **`Common.*` 是 `jest.fn()`** —— `preInit` / `init` 默认 `resolve()`,`isInited` 默认 `resolve(false)`。
- **`<ShareSheetHost />` 渲染 `null`** —— 不引 design,无需在测试里挂任何 Provider。
- **类型 / 常量 / `UmengError` 保留真实实现** —— `Platform`、`SUPPORTED_PLATFORMS`、`PLATFORM_*`、`UmengError` 等不碰 native,直接复用真值,无需额外 stub。

完整 mock 行为:

| 模块 | 默认行为 |
| --- | --- |
| `Common.preInit` / `init` | `jest.fn()`,`Promise.resolve()` |
| `Common.isInited` | `jest.fn()`,`Promise.resolve(false)` |
| `Share.shareText` / `shareImage` / `shareLink` | `jest.fn()`,resolve `{ code: 'success', platform }` |
| `Share.openSheet` | `jest.fn()`,resolve `{ code: 'success', platform: WECHAT_SESSION }` |
| `Share.isInstalled` | `jest.fn()`,`Promise.resolve(true)` |
| `Share.listPlatforms` | `jest.fn()`,全平台 `installed: true` |
| `Analytics.onEvent` / `signIn` / `signOut` | `jest.fn()`(同步 void) |
| `ShareSheetHost` | 渲染 `null` |
| `Platform` / `UmengError` / 常量 | 真实值(不 mock) |

---

## 覆盖单次返回:取消 / 失败 {#override}

默认是成功。要测「取消」「失败」,mock 额外导出 `shareSuccess` / `shareCancel` / `shareFailed` 助手,配合 `mockResolvedValueOnce` 覆盖一次:

```ts
import { Share, Platform } from '@unif/react-native-umeng';
import { shareCancel, shareFailed } from '@unif/react-native-umeng/mock';

// 模拟用户取消
(Share.shareText as jest.Mock).mockResolvedValueOnce(
  shareCancel(Platform.WECHAT_SESSION)
);

// 模拟分享失败
(Share.openSheet as jest.Mock).mockResolvedValueOnce(
  shareFailed(Platform.DINGTALK, '网络错误')
);
```

助手签名:

```ts
shareSuccess(platform: Platform): ShareResult
shareCancel(platform: Platform): ShareResult
shareFailed(platform: Platform, message?: string): ShareResult
```

:::note mock 的 `shareCancel` / `shareFailed` 返回的是 ShareResult,不是抛错
mock 助手返回普通 `ShareResult`(`code: 'cancel' | 'failed'`),用于让 `jest.fn` **resolve** 这个值。这与生产实现不同 —— 生产里 `Share.openSheet` 取消 / 失败是 **reject `UmengError`**(见[分享指南](./guides/sharing#reject-on-cancel))。若要测试 reject 分支,改用 `mockRejectedValueOnce(new UmengError('E_USER_CANCEL', '...'))`。
:::

---

## 完整示例 {#example}

```ts
import { Share, Platform, UmengError } from '@unif/react-native-umeng';
import { shareSuccess } from '@unif/react-native-umeng/mock';

jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);

describe('分享', () => {
  it('默认 resolve 成功', async () => {
    const r = await Share.openSheet({ type: 'text', text: 'hi' });
    expect(r.code).toBe('success');
  });

  it('可覆盖为指定平台成功', async () => {
    (Share.openSheet as jest.Mock).mockResolvedValueOnce(
      shareSuccess(Platform.DINGTALK)
    );
    const r = await Share.openSheet({ type: 'text', text: 'hi' });
    expect(r.platform).toBe(Platform.DINGTALK);
  });

  it('可覆盖为 reject(取消)', async () => {
    (Share.openSheet as jest.Mock).mockRejectedValueOnce(
      new UmengError('E_USER_CANCEL', 'User cancelled')
    );
    await expect(Share.openSheet({ type: 'text', text: 'hi' })).rejects.toMatchObject({
      code: 'E_USER_CANCEL',
    });
  });
});
```

---

## 下一步

- [分享指南 → 取消与失败](./guides/sharing#reject-on-cancel) —— 生产里 reject-on-cancel 的语义
- [常见问题](./troubleshooting) —— 真机 / 模拟器限制与排障
