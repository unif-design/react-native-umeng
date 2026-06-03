---
sidebar_position: 3
title: 隐私合规（PIPL）
description: "@unif/react-native-umeng 的 PIPL 两段式初始化：Common.preInit(config) 启动时调、只存配置注册平台不上报；用户同意《隐私协议》后再调无参 Common.init() 开始采集。含 init 带参 / init 早于同意两个易错点。"
---

# 隐私合规（PIPL）

本库的初始化采用 **preInit → init** 两段式,满足 PIPL(个人信息保护法)对「用户同意前不采集」的要求。本页讲清两段的职责、时序与两个易错点。

---

## 两段式设计 {#two-phase}

| 阶段 | 调用时机 | 行为 |
| --- | --- | --- |
| `Common.preInit(config)` | App 启动后立刻,**可在用户同意之前** | 存 config + 注册微信 / 钉钉平台,**不上报任何数据** |
| `Common.init()` | 用户点「同意《隐私协议》」之后 | 正式启动友盟数据采集 |

```ts
import { Common } from '@unif/react-native-umeng';

// 1) App 启动:preInit —— 不上报,所有 config 都在这里给
await Common.preInit({
  appkey: 'YOUR_UMENG_APPKEY',
  wechatAppId: 'wxXXXX',
  wechatAppSecret: 'XXXX',
  wechatUniversalLink: 'https://your.host/', // 微信 1.8.6+(iOS)要求
  dingtalkAppId: 'dingoaXXXX',
});

// 2) 用户同意《隐私协议》之后:开始采集
await Common.init();   // ⚠️ 无参 —— config 已给 preInit
```

> 两个方法都是 **idempotent**(幂等),重复调只触发一次,可放心多次调用。

:::danger init 必须在用户同意之后
`Common.init()` **必须在用户明确同意《隐私协议》之后**才能调用。隐私弹窗弹出前、或用户拒绝时,不可调 `init()`。违反将导致合规风险。
:::

---

## 推荐接入时序 {#timeline}

```
App 启动
  └─▶ Common.preInit(config)   // 立刻调,注册微信/钉钉,不采集

用户进入隐私协议弹窗
  └─▶ 用户点「同意」
        └─▶ Common.init()      // 仅此刻调,开始采集
```

---

## iOS / Android 差异 {#platform-notes}

- **Android** —— Native 侧在 `preInit` 时调友盟官方 `UMConfigure.preInit(context, appkey, channel)` 并注册微信 / 钉钉平台,行为与 JS `Common.preInit()` 一致 —— **不上报**;`init` 时才调 `UMConfigure.init` 启动采集。
- **iOS** —— 友盟 iOS SDK **没有 preInit 接口**。`preInit` 只把 config 存进 native 状态并跑平台配置,真正的 `UMConfigure.initWithAppkey` **推迟到 `init()` 才执行**。因此 `Common.init()` 调用之前,桥不会调任何会上报的友盟 iOS API。

无论哪个平台,只要保证 `init()` 在用户同意后调,即满足合规要求。

---

## 易错点(Incorrect / Correct) {#gotchas}

### 1. `init` 带参 {#init-args}

配置只给 `preInit`,`init()` **无参**:

```ts
// ❌ Incorrect:init 不接收 config
await Common.init({ appkey: '...' });
```

```ts
// ✅ Correct:config 给 preInit,init 无参
await Common.preInit({ appkey: '...', /* ... */ });
await Common.init();
```

### 2. 没先 `preInit` 就 `init`(或 init 早于同意) {#init-order}

`init` 前必须先 `preInit`,否则会 reject(`E_INVALID_OPTIONS`):

```ts
// ❌ Incorrect:没 preInit 直接 init —— reject;或在用户同意前就 init —— 违规
await Common.init();
```

```ts
// ✅ Correct:启动 preInit;用户同意后才 init
await Common.preInit({ appkey: '...' });  // App 启动
// …… 展示隐私弹窗,用户点「同意」……
await Common.init();                       // 同意后
```

---

## 相关

- [快速上手](../getting-started/quick-start#preinit) —— preInit / init 在启动流程中的位置
- [Common API](../api/common) —— preInit / init / isInited 完整参数
