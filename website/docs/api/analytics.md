---
title: 统计
description: 同步交接事件及统计用户关联。
---

# 统计

```ts
import { trackEvent, bindAnalyticsUser, clearAnalyticsUser } from '@unif/react-native-umeng';

trackEvent({ name: 'share_tap', attributes: { source: 'detail', count: 1 } });
bindAnalyticsUser({ userId: 'business-user-id', provider: 'organization' });
clearAnalyticsUser();
```

## trackEvent(input) {#trackevent}

`AnalyticsEvent` 含非空 `name` 及可选 `attributes: Readonly<Record<string, string | number>>`。只接受字符串和有限数字；数字在统计适配中转换为原生字符串，NaN、Infinity、布尔值或嵌套对象同步抛 `UmengError`，reason 为 `invalid_input`。

## bindAnalyticsUser(input) {#bindanalyticsuser}

`AnalyticsUser` 含非空 `userId` 及可选非空 `provider`。消费者在真实账号业务结果后调用；此接口只关联统计标识，不建立业务登录状态。

## clearAnalyticsUser() {#clearanalyticsuser}

同步清除 SDK 的统计用户关联。

三个方法均返回 `void`。这只表示同步交接，不证明统计服务已收到事件。调用时机由应用在初始化后安排；原生未初始化时不调用厂商、不缓存或补发事件。库不读取业务 store、不自动补初始化、不保存离线事件队列。Web 抛 `unsupported`。

[初始化](./common) · [统计指南](../guides/analytics)
