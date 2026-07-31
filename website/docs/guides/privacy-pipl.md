---
sidebar_position: 3
title: 隐私合规（PIPL）
description: "@unif/react-native-umeng 的 PIPL 两段式初始化：Common.preInit(config) 启动时只在 JS 校验并保存配置、零 native 调用；用户同意《隐私协议》后再调无参 Common.init()，才执行 vendor preInit、平台注册与正式初始化。"
---

# 隐私合规（PIPL）

本库的公共契约采用 **preInit → init** 两段式,用于满足 PIPL(个人信息保护法)对「用户同意前不采集」的要求。本页讲清两段职责与时序。

:::danger iOS 当前实现例外
JS-only `preInit` 与 Android 授权后初始化已落地。iOS native 仍保留旧的授权前 `ensurePreInit` / 授权后 `ensureInit`,而 JS spec 已改成单一 `initialize(config)`;Task 9 完成前不能声称 iOS 已满足本页的新边界。
:::

---

## 两段式设计 {#two-phase}

| 阶段 | 调用时机 | 行为 |
| --- | --- | --- |
| `Common.preInit(config)` | App 启动后立刻,**可在用户同意之前** | 仅 JS 校验、标准化并保存 config 快照,**零 native 调用** |
| `Common.init()` | 用户点「同意《隐私协议》」之后 | Android 当前执行 vendor preInit、平台注册与正式 init;iOS 目标待 Task 9 |

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

> 相同 config 的 `preInit` 与成功后的 `init` 都可安全重复。native 初始化开始后不得更换 config。

:::danger init 必须在用户同意之后
`Common.init()` **必须在用户明确同意《隐私协议》之后**才能调用。隐私弹窗弹出前、或用户拒绝时,不可调 `init()`。违反将导致合规风险。
:::

---

## 推荐接入时序 {#timeline}

```
App 启动
  └─▶ Common.preInit(config)   // 立刻调,仅存 JS 快照,零 native 调用

用户进入隐私协议弹窗
  └─▶ 用户点「同意」
        └─▶ Common.init()      // 仅此刻调,开始采集
```

---

## iOS / Android 差异 {#platform-notes}

- **Android** —— JS `Common.preInit()` 不触达 native。用户同意后调 `Common.init()`,native 才在一次状态机事务中执行 `UMConfigure.preInit`、平台注册与 `UMConfigure.init`。
- **iOS 目标(Task 9)** —— JS `Common.preInit()` 同样不触达 native;用户同意后一次 `initialize(config)` 才设置 Universal Link、注册平台并执行 `UMConfigure.initWithAppkey`。当前旧 native 两方法尚未替换,不列为已支持。

除调用时序外,还必须完成原生实现与回调门禁验证;不能只凭“业务在同意后调用 `init()`”就替 iOS 当前旧实现作合规结论。

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

`init` 前必须先 `preInit`,否则会 reject(`E_NOT_INITIALIZED`):

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
