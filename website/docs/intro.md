---
sidebar_position: 1
title: 介绍
description: "@unif/react-native-umeng 是友盟 RN 新架构桥，做两件事：U-Share（首版仅微信会话 + 钉钉分享）与 U-App 移动统计；命令式 Share.openSheet() 拉起分享面板，PIPL 两段式 preInit→init 合规初始化。"
slug: /intro
---

# @unif/react-native-umeng

友盟（U-Share + U-App 移动统计）的 **React Native 新架构桥**:一次 `await Share.openSheet(payload)` 拉起分享面板,一行 `Analytics.onEvent(id)` 记录埋点,统计采集遵循 PIPL 两段式合规。

:::info 当前验证边界
iOS 的 `initialize(config)` 状态机、Share/Analytics 门禁、TurboModule 注册与宿主回调接线已通过 native contract、simulator build 和 XCTest。Android 源码/static native contract 已核对，仓库已有 JVM tests，但本轮未执行 Gradle/JVM，留待 Android SDK CI。真实微信 / 钉钉回跳、iOS Universal Link/AASA 与 minified release 仍须在对应环境和真机验证。
:::

[![npm](https://img.shields.io/npm/v/@unif/react-native-umeng.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-umeng)
[![CI](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-umeng.svg?color=blue)](https://github.com/unif-design/react-native-umeng/blob/main/LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-umeng/)

## 这个库是什么

它在友盟官方 SDK(U-Share 社会化分享 + U-App 移动统计)之上,封装出一套**新架构(TurboModule)友好、UI 文案中文**的 React Native 接口。对外只有三个命名空间加一个宿主组件:

- **`Common`** —— `preInit` / `init` / `isInited`,PIPL 两段式初始化。
- **`Share`** —— `openSheet`(命令式分享面板)/ `shareText` / `shareImage` / `shareLink` / `isInstalled` / `listPlatforms`。
- **`Analytics`** —— `onEvent` / `signIn` / `signOut`,自定义事件与账号埋点。
- **`<ShareSheetHost />`** —— 命令式分享面板的宿主组件,在 App 根挂一次。

分享面板用 RN `Modal` 承载,内部复用 [`@unif/react-native-design`](https://www.npmjs.com/package/@unif/react-native-design) 的 `Cell` / `Button`,与 design 的命令式 API 一样采用「单例 controller + Host」模式。

## 解决什么问题

直接接友盟原生 SDK,你要分别处理 iOS / Android 的初始化时序、平台注册、分享回调跳回、PIPL 合规启停,还要自己拼一套分享面板 UI。本库把这些收敛成几次声明式调用:

```tsx
import { Share, UmengError } from '@unif/react-native-umeng';

try {
  const r = await Share.openSheet({ type: 'link', title: '问问看', url: 'https://example.com' });
  // 只有成功才走到这里:r.code 恒为 'success'
} catch (e) {
  if (e instanceof UmengError && e.code === 'E_USER_CANCEL') { /* 用户取消 */ }
}
```

## 核心概念

- **首版只支持微信会话 + 钉钉** —— `Platform` 枚举只有 `WECHAT_SESSION` 与 `DINGTALK` 两个成员。**没有朋友圈、QQ、微博**;传未支持的平台会抛 `E_PLATFORM_NOT_SUPPORTED`。
- **分享面板 = session controller + Host 组件** —— `Share.openSheet()` 是推荐用法,它经模块级 controller 拉起 `<ShareSheetHost />` 渲染的 RN `Modal`。**Host 必须在 App 根挂一次**,否则立即 reject;一次只能有一个 session,迟到 callback 不能结算新 session,owner Host 卸载会 reject active Promise。
- **取消 / 失败走 reject,不走 resolve** —— `openSheet` 与 `shareText/shareImage/shareLink` 在用户取消或分享失败时**抛 `UmengError`**(`E_USER_CANCEL` / `E_SHARE_FAILED`)。**resolve 到手的结果 `code` 恒为 `'success'`** —— 永远 try/catch,别去判 `r.code === 'cancel'`(到不了)。
- **PIPL 两段式:`preInit`(JS-only)→ 同意 →`init`(native 初始化与采集)** —— `Common.preInit(config)` 在 App 启动后只校验并保存 JS config 快照,不调用 native、不注册平台;用户同意《隐私协议》后再调**无参**的 `Common.init()`,native 才执行各平台对应的 vendor bootstrap。
- **统计是同步 `void`** —— `Analytics.onEvent / signIn / signOut` 没有 Promise,**不要 await**。

## 能力

- **命令式分享面板** —— `Share.openSheet({ type, ... })` 一行拉起 RN `Modal` 底部面板,用户选平台,Promise resolve 成功 / reject 取消失败。
- **三种分享内容** —— 文本(`'text'`)、图片(`'image'`)、链接(`'link'`),面板与直拉变体共用同一套 `payload`。
- **直拉单平台** —— 不需要面板时,`Share.shareText / shareImage / shareLink` 跳过 UI 直接发到指定平台。
- **PIPL 合规初始化** —— `preInit` / `init` 两段式,满足「用户同意前不采集」。
- **自定义事件 + 账号埋点** —— `Analytics.onEvent / signIn / signOut`,数字参数自动字符串化。
- **官方 Jest mock** —— 随包导出 `./mock`,测试里整包替换,无需手写 stub。

## 何时使用

| 适用 | 不适用 |
| --- | --- |
| 分享到**微信会话**或**钉钉**(文本 / 图片 / 链接) | 分享到**朋友圈 / QQ / 微博** —— 首版不支持 |
| 需要一套现成的中文分享面板 UI | 完全自定义的分享 UI(可直拉 `shareXxx` 自绘) |
| 友盟自定义事件 / 账号登录登出埋点 | 非友盟的统计后端 |
| PIPL 两段式合规采集启停 | —— |

## 平台支持

| 平台 | 支持 |
| --- | --- |
| iOS | ✅ native contract / simulator / XCTest；真实平台回跳待真机 |
| Android | 源码/static contract 已核对；Gradle/JVM 与真实回跳待 CI/SDK |
| Web / 模拟器 | 文档、JS 与 native 单测可运行；不能完成真分享 |

:::info 仅支持新架构
本库是 TurboModule 桥,当前只验证 **React Native 0.85 New Architecture**、React 19。旧架构(Bridge)不在目标范围,也不能把当前证据外推到其他 RN 版本。
:::

:::warning 分享必须真机验证
模拟器没有真微信 / 钉钉,无法完成真实回调跳转,所以端到端分享必须真机验证。仓库已经通过 iOS simulator Pod/Codegen/build/XCTest,但这些证据不能替代真机 URL Scheme、Universal Link/AASA 与平台回包矩阵。
:::

## 下一步

- [安装](./getting-started/installation) —— 装齐 peerDeps、跑 pod install、原生配置指针
- [快速上手](./getting-started/quick-start) —— 5 分钟跑通初始化 + 第一次分享
- [指南 → 分享](./guides/sharing) —— 面板 / 直拉、内容类型、取消失败处理
- [指南 → 隐私合规(PIPL)](./guides/privacy-pipl) —— 两段式初始化时序
- [API 参考 → Common](./api/common) —— 完整 API 文档
