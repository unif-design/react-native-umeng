---
sidebar_position: 3
title: Analytics
description: onEvent / signIn / signOut — U-App 移动统计 API 完整参考。
---

# Analytics

U-App 移动统计 API。

## 引用

```ts
import { Analytics } from '@unif/react-native-umeng';
```

---

## `Analytics.onEvent(eventId, params?)`

自定义事件埋点。

```ts
Analytics.onEvent(
  eventId: string,
  params?: Record<string, string | number>
): void
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `eventId` | `string` | ✅ | 友盟后台定义的事件 ID |
| `params` | `Record<string, string \| number>?` | — | 事件属性；`number` 值自动 stringify（友盟 iOS attributes 强制 `NSString`） |

---

## `Analytics.signIn(userId, provider?)`

用户登录账号埋点。

```ts
Analytics.signIn(userId: string, provider?: string): void
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `userId` | `string` | ✅ | 业务用户 ID |
| `provider` | `string?` | — | 登录方式标识，如 `'WX'` / `'DD'` |

---

## `Analytics.signOut()`

用户登出。

```ts
Analytics.signOut(): void
```

---

## 平台支持

| API | iOS | Android |
| --- | --- | --- |
| `onEvent` | ✅ | ✅ |
| `signIn` | ✅ | ✅ |
| `signOut` | ✅ | ✅ |

## 相关

- [统计埋点指南](../guides/analytics)
- [Common API](./common)
