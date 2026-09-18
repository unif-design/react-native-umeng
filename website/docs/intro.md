---
sidebar_position: 1
title: 介绍
description: 'React Native 友盟接入：初始化、微信会话与钉钉分享、分享面板和应用统计。'
slug: /intro
---

# Umeng 分享与统计

友盟 SDK 的 React Native 接入库，提供微信会话／钉钉分享、分享面板和应用统计。由 Unif 维护，可用于其他 React Native 项目。

## 功能

| 需求                   | 入口                                                |
| ---------------------- | --------------------------------------------------- |
| 准备配置与初始化       | [Common](/docs/api/common)                          |
| 分享文本、图片或链接   | [Share](/docs/api/share)                            |
| 展示平台选择面板       | [ShareSheetHost](/docs/api/platform-sharesheethost) |
| 记录事件与统计用户标识 | [Analytics](/docs/api/analytics)                    |

## 开始使用

按[安装指南](/docs/getting-started/installation)配置依赖和原生回调，再按[快速上手](/docs/getting-started/quick-start)完成初始化与首次分享。

`preInit(config)` 只保存配置，应用取得用户同意后再调用 `init()` 进入原生 SDK。分享成功时 resolve，取消或失败时 reject；Analytics 方法返回同步 `void`。

## 平台说明

支持 iOS／Android 的 React Native 新架构。真实分享需要设备安装对应的微信或钉钉应用，并完成平台回调配置；模拟器和单测不代替真实拉起与回包验证。

[分享指南](/docs/guides/sharing) · [初始化与用户同意](/docs/guides/privacy-pipl) · [测试](/docs/testing) · [常见问题](/docs/troubleshooting)
