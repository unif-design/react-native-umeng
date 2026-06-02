---
sidebar_position: 1
title: 简介
description: "@unif/react-native-umeng — 友盟 RN 桥：U-Share（微信会话 / 钉钉）+ U-App 移动统计。Unif 私有。"
slug: /intro
---

# @unif/react-native-umeng

[![npm](https://img.shields.io/npm/v/@unif/react-native-umeng.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-umeng)
[![CI](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-umeng.svg?color=blue)](https://github.com/unif-design/react-native-umeng/blob/main/LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-umeng/)

友盟移动统计 + U-Share 的 React Native 桥，提供：

- **Common** — `preInit` / `init` / `isInited`，PIPL 合规双阶段采集启停
- **Share** — 微信会话 + 钉钉分享（文本 / 图片 / 链接 / 命令式面板）
- **Analytics** — `onEvent` / `signIn` / `signOut` 自定义事件 + 账号埋点
- **ShareSheet UI** — 基于 [`@unif/react-native-design`](https://www.npmjs.com/package/@unif/react-native-design) 的 BottomSheet + Cell，命令式 `Share.openSheet()` 拉起即用

:::tip PIPL 合规：preInit 不上报，init 才采集
`Common.preInit()` 仅存 config 并注册微信/钉钉平台，**不触发任何数据上报**。`Common.init()` 必须在用户明确同意《隐私协议》之后才能调用。详见[隐私合规指南](./guides/privacy-pipl)。
:::

## 平台支持

| 平台    | 支持 |
| ------- | ---- |
| iOS     | ✅   |
| Android | ✅   |
| Web     | ❌   |

:::warning 真机验证
分享功能会调起原生微信 / 钉钉面板，**必须在真机上验证**。模拟器无法跳转外部 App，无法完整测试回调链路。
:::

## 下一步

- [快速开始 → 安装](./getting-started/installation)
- [快速开始 → 快速上手](./getting-started/quick-start)
- [指南 → 分享](./guides/sharing)
- [API 参考 → Common](./api/common)
