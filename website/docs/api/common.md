---
sidebar_position: 1
title: Common
description: preInit / init / isInited — 友盟 SDK 双阶段初始化 API。
---

# Common

双阶段初始化 API，满足 PIPL 合规要求。

## 引用

```ts
import { Common } from '@unif/react-native-umeng';
```

---

## `Common.preInit(config)`

预初始化友盟 SDK。可在用户同意《隐私协议》之前调用。

**行为**：存 config + 注册微信/钉钉平台，**不上报数据**。idempotent — 重复调只触发一次。

```ts
await Common.preInit(config: UmengInitConfig): Promise<void>
```

### `UmengInitConfig` 参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `appkey` | `string` | ✅ | 友盟 appkey |
| `channel` | `string?` | — | 渠道标识。默认 iOS = `'App Store'`，Android = `'default'` |
| `wechatAppId` | `string?` | — | 微信平台 appid；不传则不注册微信分享 |
| `wechatAppSecret` | `string?` | — | 微信平台 appsecret；有 `wechatAppId` 才生效 |
| `wechatUniversalLink` | `string?` | — | 微信 Universal Link（1.8.6+ 强制）；iOS 才用，有 `wechatAppId` 才生效 |
| `dingtalkAppId` | `string?` | — | 钉钉平台 appid；不传则不注册钉钉分享 |

---

## `Common.init()`

正式启动数据采集。**必须在用户同意《隐私协议》之后调用**，且 `preInit()` 必须先调过。

idempotent — 重复调只触发一次。

```ts
await Common.init(): Promise<void>
```

---

## `Common.isInited()`

查询是否已完成 `init()`。

```ts
const inited: boolean = await Common.isInited();
```

---

## 隐私合规

详见[隐私合规指南](../guides/privacy-pipl)。

---

## 平台支持

| API | iOS | Android |
| --- | --- | --- |
| `preInit()` | ✅（桥侧存 config，不调友盟 iOS API） | ✅（Native 构造时自动 `UMConfigure.preInit`） |
| `init()` | ✅ | ✅ |
| `isInited()` | ✅ | ✅ |

## 相关

- [隐私合规指南](../guides/privacy-pipl)
- [快速上手](../getting-started/quick-start)
