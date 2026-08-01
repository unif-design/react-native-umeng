---
sidebar_position: 2
title: 统计埋点
description: "用 @unif/react-native-umeng 的 U-App 统计：Analytics.onEvent / signIn / signOut 都是同步 void（不要 await），onEvent 的 number 参数自动字符串化，数据上报需先 Common.init()。"
---

# 统计埋点

本页介绍如何用 `@unif/react-native-umeng` 记录 U-App 移动统计 —— 自定义事件与账号登录 / 登出埋点。

:::warning 三个方法都是同步 `void`,不要 await
`Analytics.onEvent` / `signIn` / `signOut` **没有返回 Promise**,直接同步调用即可。`await` 一个 `undefined` 没有意义。
:::

---

## 自定义事件 {#on-event}

```ts
import { Analytics } from '@unif/react-native-umeng';

Analytics.onEvent('login');                                  // 无参数
Analytics.onEvent('share_click', { source: 'detail' });      // 字符串参数
Analytics.onEvent('page_view', { page: 'home', duration: 30 }); // 含数字参数
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `eventId` | `string` | 事件 ID(需与友盟后台配置一致) |
| `params` | `Record<string, string \| number>?` | 事件属性,可选 |

:::note 数字参数自动字符串化
`params` 里 value 为 `number` 时会自动 `String()` 转成字符串 —— 友盟 iOS 的 attributes 强制要求 `NSString`。所以 `{ duration: 30 }` 上报时是 `"30"`,你不必手动转。
:::

---

## 账号登录埋点 {#sign-in}

```ts
Analytics.signIn('user-123', 'WX');  // provider 可选
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | `string` | 业务用户 ID |
| `provider` | `string?` | 登录方式标识,如 `'WX'` / `'DD'` |

## 账号登出埋点 {#sign-out}

```ts
Analytics.signOut();
```

---

## 易错点:不要 await `Analytics.*` {#no-await}

```ts
// ❌ Incorrect:它们是同步 void,await 一个 undefined 没意义
await Analytics.onEvent('login');
const ok = await Analytics.signIn('user-123'); // ok 永远是 undefined
```

```ts
// ✅ Correct:直接同步调用
Analytics.onEvent('login');
Analytics.signIn('user-123', 'WX');
Analytics.signOut();
```

---

:::warning 采集需先 `Common.init()`
`Analytics.*` 的数据上报依赖 `Common.init()` 已完成。Android 与 iOS 在 init 前都会在 native adapter/vendor 之前同步 no-op，不缓存或补发该事件。两段式合规见[隐私合规(PIPL)](./privacy-pipl)。
:::

## 相关

- [Analytics API](../api/analytics) —— 完整签名
- [Common API](../api/common) —— preInit / init / isInited
