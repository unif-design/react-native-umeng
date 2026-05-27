---
sidebar_position: 1
title: 简介
description: 安装 @unif/react-native-umeng 并接好友盟微信/钉钉分享
slug: /intro
---

# 简介

`@unif/react-native-umeng` 是友盟移动统计 + U-Share 的 React Native 桥，提供：

- **Common** —— `Common.init()` / `Common.isInited()`，PIPL 合规启停数据采集
- **Share** —— 微信会话 + 钉钉分享（文本 / 图片 / 链接 / 命令式面板）
- **Analytics** —— `onEvent` / `signIn` / `signOut` 自定义事件 + 账号埋点
- **ShareSheet UI** —— 基于 [`@unif/react-native-design`](https://www.npmjs.com/package/@unif/react-native-design) 的 BottomSheet + Cell，命令式 `Share.openSheet()` 拉起即用

## 安装

```bash
yarn add @unif/react-native-umeng \
  @unif/react-native-design \
  @gorhom/bottom-sheet \
  react-native-gesture-handler \
  react-native-svg
```

## 一分钟跑通

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import {
  Common, Share, Platform, ShareSheetHost,
} from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <YourScreen />
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

async function onShareTap() {
  // 1. 用户同意《隐私协议》后,一次性调
  await Common.init();

  // 2. 命令式分享面板
  const r = await Share.openSheet({
    type: 'link',
    title: 'Unif Umeng',
    url: 'https://example.com',
    description: '一键拉起微信/钉钉',
  });
  // r = { code: 'success' | 'cancel' | 'failed', platform, message? }
}
```

## 下一步

- [ShareSheet 用法](./share-sheet) —— 命令式 API + 平台筛选 + 错误处理
- 宿主集成（iOS Info.plist / Android Manifest / Proguard）见 [README](https://github.com/unif-design/react-native-umeng#readme)

## 版本

当前文档对应 `@unif/react-native-umeng@0.1.0`。
