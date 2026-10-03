---
title: 简介
description: 友盟初始化、微信会话与钉钉分享及同步统计交接。
---

# 简介

`@unif/react-native-umeng` 提供独立的 SDK 初始化、已配置平台查询、分享与统计。`useShareSheet` 通过这些能力组合实例内的平台选择面板，支持 modal 与 floating。

- 初始化：`initializeUmeng`、`isUmengInitialized`。
- 分享：`getShareTargets`、`share`、`useShareSheet`。
- 统计：`trackEvent`、`bindAnalyticsUser`、`clearAnalyticsUser`。

真实分享支持 iOS 与 Android 的微信会话、钉钉；Web 明确报告 `unsupported`。截图、上传、业务同意记录、账号状态、导航和业务结果保存由消费者负责。

[安装](./getting-started/installation) · [快速上手](./getting-started/quick-start) · [测试](./testing) · [常见问题](./troubleshooting)
