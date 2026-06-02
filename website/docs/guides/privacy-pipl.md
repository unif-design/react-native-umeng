---
sidebar_position: 3
title: 隐私合规（PIPL）
description: preInit 不上报、init 才采集的双阶段合规设计，及 iOS / Android 的差异说明。
---

# 隐私合规（PIPL）

## 双阶段设计

本库采用 **preInit → init** 双阶段设计，满足 PIPL（个人信息保护法）对"用户同意前不采集"的要求：

| 阶段 | 调用时机 | 行为 |
| --- | --- | --- |
| `Common.preInit(config)` | App 启动后立刻，**可在用户同意之前** | 存 config + 注册微信/钉钉平台，**不上报任何数据** |
| `Common.init()` | 用户点击同意《隐私协议》之后 | 正式启动友盟数据采集 |

:::danger init 必须在用户同意后
`Common.init()` **必须在用户明确同意《隐私协议》之后**才能调用。在隐私弹窗弹出之前、或用户拒绝时，不可调用 `init()`。违反此约定将导致合规风险。
:::

## Android 说明

Android 模块在 Native 侧构造时会自动调用 `UMConfigure.preInit`（友盟官方 Android preInit 接口），行为与 JS `Common.preInit()` 一致——**不上报数据**。JS `Common.init()` 后才正式启动采集。

## iOS 说明

友盟 iOS SDK **无 preInit 接口**。因此，JS `Common.init()` 调用之前，桥不会调用任何友盟 iOS API。请确保 `Common.init()` 只在用户同意后执行。

## 推荐接入时序

```
App 启动
  └─▶ Common.preInit(config)   // 立刻调，注册微信/钉钉，不采集

用户进入隐私协议弹窗
  └─▶ 用户点「同意」
        └─▶ Common.init()      // 仅此刻调，开始采集
```

## 相关

- [Common API](../api/common) — preInit / init / isInited 完整参数
