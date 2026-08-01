---
sidebar_position: 3
title: Analytics
description: "Analytics API 全量参考：onEvent(eventId, params?) / signIn(userId, provider?) / signOut() —— U-App 移动统计。三个方法都是同步 void、不返回 Promise、不要 await；onEvent 的 number 值会自动 stringify（友盟 iOS attributes 强制 NSString）。"
---

# Analytics

U-App 移动统计 API。三个方法都是**同步 `void`**，不返回 Promise。

## 引用 {#import}

```ts
import { Analytics } from '@unif/react-native-umeng';
```

| 方法 | 签名 | 返回 |
| --- | --- | --- |
| [`onEvent`](#onevent) | `onEvent(eventId, params?)` | `void` |
| [`signIn`](#signin) | `signIn(userId, provider?)` | `void` |
| [`signOut`](#signout) | `signOut()` | `void` |

:::warning 同步 void，不要 await
`Analytics.*` 全是同步方法，**没有 Promise**。`await Analytics.onEvent(...)` 只会 await 一个 `undefined`，没有意义。
:::

---

## `Analytics.onEvent(eventId, params?)` {#onevent}

自定义事件埋点。

```ts
function onEvent(
  eventId: string,
  params?: Record<string, string | number>
): void;
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `eventId` | `string` | ✅ | 友盟后台定义的事件 ID |
| `params` | `Record<string, string \| number>` | — | 事件属性；`number` 值自动 `String()` stringify（友盟 iOS attributes 强制 `NSString`） |

```ts
Analytics.onEvent('share_tap', { source: 'detail', count: 1 }); // count 自动转 '1'
```

---

## `Analytics.signIn(userId, provider?)` {#signin}

用户登录账号埋点。

```ts
function signIn(userId: string, provider?: string): void;
```

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `userId` | `string` | ✅ | 业务用户 ID |
| `provider` | `string` | — | 登录方式标识，如 `'WX'` / `'DD'` |

---

## `Analytics.signOut()` {#signout}

用户登出。

```ts
function signOut(): void;
```

---

## 平台支持 {#platform-support}

| API | iOS | Android |
| --- | --- | --- |
| `onEvent` | ✅ | ✅ |
| `signIn` | ✅ | ✅ |
| `signOut` | ✅ | ✅ |

> 埋点需要先完成 [`Common.init()`](./common#init) 才会真正上报。Android 与 iOS native 在未 init 时都同步 no-op，不缓存或补发这次事件；三个入口均在 vendor adapter 前执行门禁。

## 相关 {#related}

- [统计埋点指南](../guides/analytics) —— 任务导向用法
- [Common API](./common) —— 初始化（埋点上报的前提）
