---
sidebar_position: 2
title: 统计埋点
description: U-App 移动统计：自定义事件、账号登录/登出埋点用法指南。
---

# 统计埋点

## 自定义事件

```ts
import { Analytics } from '@unif/react-native-umeng';

Analytics.onEvent('login', { channel: 'wechat' });
Analytics.onEvent('page_view', { page: 'home', duration: 30 });
```

`params` 的 value 为 `number` 时会自动 stringify（友盟 iOS attributes 强制 `NSString`）。

## 账号登录埋点

```ts
Analytics.signIn('user-123', 'WX');
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | `string` | 业务用户 ID |
| `provider` | `string?` | 登录方式标识，如 `'WX'` / `'DD'` |

## 账号登出埋点

```ts
Analytics.signOut();
```

:::warning 采集需先 init
`Analytics.*` 的数据上报依赖 `Common.init()` 已调过。如果 `init` 未执行（用户未同意《隐私协议》），调用不会崩溃，但数据不会上报。详见[隐私合规指南](./privacy-pipl)。
:::

## 相关

- [Analytics API](../api/analytics) — 完整签名
- [Common API](../api/common) — init / preInit
