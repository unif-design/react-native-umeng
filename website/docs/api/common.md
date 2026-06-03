---
sidebar_position: 1
title: Common
description: "Common API 全量参考：preInit(config) / init() / isInited() — 友盟 SDK 两段式初始化（PIPL 合规）。preInit 接收全部 config（appkey 必填、channel / wechatAppId / wechatAppSecret / wechatUniversalLink / dingtalkAppId 可选），init() 无参，未先 preInit 直接 init 会 reject E_INVALID_OPTIONS。"
---

# Common

两段式初始化 API，满足 PIPL 合规要求 —— 用户同意《隐私协议》前 native 不持有 appkey、不上报数据。

## 引用 {#import}

```ts
import { Common } from '@unif/react-native-umeng';
```

| 方法 | 签名 | 返回 |
| --- | --- | --- |
| [`preInit`](#preinit) | `preInit(config: UmengInitConfig)` | `Promise<void>` |
| [`init`](#init) | `init()` | `Promise<void>` |
| [`isInited`](#isinited) | `isInited()` | `Promise<boolean>` |

---

## `Common.preInit(config)` {#preinit}

预初始化友盟 SDK。可在用户同意《隐私协议》之前调用，推荐 **App 启动后立刻调**。

**行为**：存 config + 注册微信/钉钉平台（`PlatformConfig.setWeixin` / `setDing`），**不上报数据**。**idempotent** —— 重复调只触发一次（模块级 `preInitPromise` 缓存 + native `UmengBootstrap` 的 `@Volatile` 双重保险）。

```ts
function preInit(config: UmengInitConfig): Promise<void>;
```

### `UmengInitConfig` 字段 {#umenginitconfig}

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `appkey` | `string` | ✅ | — | 友盟 appkey |
| `channel` | `string` | — | iOS `'App Store'`、Android `'default'` | 渠道标识 |
| `wechatAppId` | `string` | — | — | 微信平台 appid；不传则不注册微信分享 |
| `wechatAppSecret` | `string` | — | — | 微信平台 appsecret；有 `wechatAppId` 才生效 |
| `wechatUniversalLink` | `string` | — | — | 微信 Universal Link（1.8.6+ 强制）；**仅 iOS 用**，有 `wechatAppId` 才生效 |
| `dingtalkAppId` | `string` | — | — | 钉钉平台 appid；不传则不注册钉钉分享 |

> 微信注册要求 `wechatAppId` **与** `wechatAppSecret` 同时非空才生效；钉钉只需 `dingtalkAppId`。

### 抛出 {#preinit-errors}

| `UmengError.code` | 触发 |
| --- | --- |
| `E_INVALID_OPTIONS` | `config.appkey` 缺失或为空（JS 层先校验，native 侧也会再校验） |
| `E_UNKNOWN` | native preInit 其它失败 |

---

## `Common.init()` {#init}

正式启动数据采集。**必须在用户同意《隐私协议》之后调用**，且 `preInit(config)` 必须先调过。

```ts
function init(): Promise<void>;
```

:::warning init 无参
config 全部交给 `preInit`，`init()` **不接收任何参数**。没先 `preInit` 直接 `init` 会 reject `E_INVALID_OPTIONS`。
:::

**行为**：调原生 `UMConfigure.init`（iOS `UMConfigure.initWithAppkey`），真正开始统计与上报。**idempotent** —— 重复调只触发一次。

### 抛出 {#init-errors}

| `UmengError.code` | 触发 |
| --- | --- |
| `E_INVALID_OPTIONS` | 未先 `preInit` 就调 `init`（iOS native error code `-3`） |
| `E_UNKNOWN` | native init 其它失败 |

---

## `Common.isInited()` {#isinited}

查询是否已完成 `init()`（即数据采集是否已开始）。

```ts
function isInited(): Promise<boolean>;
```

返回 `true` 表示已 `init`；`preInit` 完成但尚未 `init` 时返回 `false`。

---

## 最小用法 {#usage}

```ts
import { Common } from '@unif/react-native-umeng';

// 1) App 启动:preInit —— 不上报,所有 config 都在这里给
await Common.preInit({
  appkey: 'YOUR_APPKEY',
  wechatAppId: 'wxXXXXXXXX',
  wechatAppSecret: 'XXXXXXXX',
  wechatUniversalLink: 'https://your.host/', // 微信 1.8.6+(iOS)
  dingtalkAppId: 'dingoaXXXXXXXX',
});

// 2) 用户同意《隐私协议》后:init() 无参,开始采集
await Common.init();
```

---

## 平台支持 {#platform-support}

| API | iOS | Android |
| --- | --- | --- |
| `preInit()` | ✅（桥侧存 config + `setPlaform` 注册平台，不调 `UMConfigure.initWithAppkey`，无上报副作用） | ✅（`UMConfigure.preInit` + `PlatformConfig.setWeixin/setDing`） |
| `init()` | ✅（`UMConfigure.initWithAppkey`） | ✅（`UMConfigure.init`） |
| `isInited()` | ✅ | ✅ |

> `wechatUniversalLink` 仅 iOS 生效（Android 无此概念）。

## 相关 {#related}

- [隐私合规（PIPL）](../guides/privacy-pipl) —— 两段式初始化的合规依据与时序
- [快速上手](../getting-started/quick-start) —— 完整接入流程
- [常见问题 → init 顺序](../troubleshooting#init-order)
