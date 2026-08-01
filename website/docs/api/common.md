---
sidebar_position: 1
title: Common
description: "Common API 全量参考：preInit(config) / init() / isInited() — 友盟 SDK 两段式初始化（PIPL 合规）。preInit 只在 JS 保存配置快照且不触达 native；用户同意后调用无参 init() 才执行 native 初始化。未先 preInit 直接 init 会 reject E_NOT_INITIALIZED。"
---

# Common

两段式初始化的公共契约:用户同意《隐私协议》前 JS 只保存 config 快照,授权后 `init()` 才允许进入 native。Android 与 iOS 都通过单一 private native `initialize(config)` 执行授权后的 vendor bootstrap。

:::info 验证边界
iOS bootstrap 已通过 simulator build、XCTest 与 native contract。Android 源码/static native contract 已核对，仓库已有状态机 JVM tests，但本轮未执行 Gradle/JVM，留待 Android SDK CI。真实第三方平台行为仍须真机验证。
:::

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

准备初始化配置。可在用户同意《隐私协议》之前调用，推荐 **App 启动后立刻调**；方法名保留 `preInit`，但它不会预初始化 vendor SDK。

**行为**：只在 JS 侧校验、标准化并冻结/保存不可变 config 快照,**不调用 native、不注册平台、不上报数据**。相同 config 可安全重复;native 初始化开始前可用新的合法 config 替换快照,开始后不得再换 config。

```ts
function preInit(config: UmengInitConfig): Promise<void>;
```

### `UmengInitConfig` 字段 {#umenginitconfig}

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `appkey` | `string` | ✅ | — | 友盟 appkey |
| `channel` | `string` | — | iOS `'App Store'`、Android `'default'` | 渠道标识 |
| `wechatAppId` | `string` | 启用微信时 | — | 微信平台 App ID；与下列微信字段按平台严格成组 |
| `wechatAppSecret` | `string` | 启用微信时 | — | 微信平台 App Secret；必须与 `wechatAppId` 同时提供 |
| `wechatUniversalLink` | `string` | iOS 启用微信时 | — | 带 host 的绝对 HTTPS URL；Android 可省略 |
| `dingtalkAppId` | `string` | — | — | 钉钉平台 appid；不传则不注册钉钉分享 |

组合校验不会静默忽略半套配置:

- `config` 必须是对象,`appkey` 必须为非空字符串;其余字段一旦出现也必须是非空字符串。
- 任一微信字段出现时,`wechatAppId` 与 `wechatAppSecret` 必须同时提供。
- iOS 目标还要求同时提供 `wechatUniversalLink`;Android 可以不传,传入时仍会进入快照并校验。
- `wechatUniversalLink` 必须是带 host 的绝对 `https://` URL。
- 钉钉只需非空 `dingtalkAppId`。

### 抛出 {#preinit-errors}

| `UmengError.code` | 触发 |
| --- | --- |
| `E_INVALID_OPTIONS` | 必填字段缺失、平台字段组合非法,或 native 初始化开始后尝试更换 config |

---

## `Common.init()` {#init}

正式启动数据采集。**必须在用户同意《隐私协议》之后调用**，且 `preInit(config)` 必须先调过。

```ts
function init(): Promise<void>;
```

:::warning init 无参
config 全部交给 `preInit`，`init()` **不接收任何参数**。没先 `preInit` 直接 `init` 会 reject `E_NOT_INITIALIZED`。
:::

**行为**：首次在此处把 config 快照交给 native。Android 在同一次受控初始化内依次执行 vendor preInit、微信 / 钉钉平台注册、FileProvider 设置与正式 init,全部返回后才启用已配置平台的回调 Activity。iOS 在主线程按 Universal Link → 微信注册 → 钉钉注册 → `UMConfigure.initWithAppkey` 执行。进行中的 JS 调用复用同一个 Promise,成功后的重复调用直接完成。

native 失败不会把不确定副作用伪装成可安全回滚：Android 的不确定 vendor 失败和 iOS vendor exception 都进入需要完整进程重启的 terminal 状态；iOS 明确的平台 `setPlaform == NO` 则保留已完成阶段并允许同配置重试。

### 抛出 {#init-errors}

| `UmengError.code` | 触发 |
| --- | --- |
| `E_NOT_INITIALIZED` | 未先 `preInit` 就调 `init` |
| `E_INVALID_OPTIONS` | 初始化开始后尝试更换 config |
| `E_UNKNOWN` | native init 其它失败 |

---

## `Common.isInited()` {#isinited}

查询是否已完成 `init()`（即数据采集是否已开始）。

```ts
function isInited(): Promise<boolean>;
```

返回 `true` 表示已 `init`；`preInit` 完成但尚未 `init` 时返回 `false`。

native reject 或返回非 boolean 时,JS 统一抛 `E_UNKNOWN`,并在 `nativeError` 保留原始值。`isInited()` 查询的是 native 状态,不是仅检查 JS 是否保存过 config。

---

## 最小用法 {#usage}

```ts
import { Common } from '@unif/react-native-umeng';

// 1) App 启动:preInit —— 不上报,所有 config 都在这里给
await Common.preInit({
  appkey: 'YOUR_APPKEY',
  wechatAppId: 'YOUR_WECHAT_APP_ID',
  wechatAppSecret: 'YOUR_WECHAT_APP_SECRET',
  wechatUniversalLink: 'https://your.host/', // 微信 1.8.6+(iOS)
  dingtalkAppId: 'YOUR_DINGTALK_APP_ID',
});

// 2) 用户同意《隐私协议》后:init() 无参,开始采集
await Common.init();
```

---

## 平台支持 {#platform-support}

| API | iOS | Android |
| --- | --- | --- |
| `preInit()` | ✅ JS-only、零 native/vendor | ✅ JS-only、零 native/vendor |
| `init()` | ✅ UL + 平台注册 + `UMConfigure.initWithAppkey` | ✅ vendor preInit + 平台注册 + FileProvider + init |
| `isInited()` | ✅ | ✅ |

> `wechatUniversalLink` 仅 iOS 生效（Android 无此概念）。表格描述当前实现；iOS simulator/XCTest 已有通过证据，Android Gradle/JVM 本轮未执行，真实平台回跳也尚未真机验收。

## 相关 {#related}

- [隐私合规（PIPL）](../guides/privacy-pipl) —— 两段式初始化的合规依据与时序
- [快速上手](../getting-started/quick-start) —— 完整接入流程
- [常见问题 → init 顺序](../troubleshooting#init-order)
