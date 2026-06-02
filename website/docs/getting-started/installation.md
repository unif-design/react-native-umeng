---
sidebar_position: 1
title: 安装
description: 安装 @unif/react-native-umeng 及 peer 包，完成 iOS pod install。
---

# 安装

## 1. 安装依赖

```sh
yarn add @unif/react-native-umeng \
  @unif/react-native-design \
  @gorhom/bottom-sheet \
  react-native-gesture-handler \
  react-native-svg
```

:::warning `@unif/react-native-design` 是 UI 壳 peer，必装
ShareSheet UI 基于 `@unif/react-native-design` 的 BottomSheet / Cell / Button 渲染，**不能省略**。同时需要根组件包裹 `<ThemeProvider>` 和 `<GestureHandlerRootView>`，见[快速上手](./quick-start)。
:::

## 2. iOS — pod install

```sh
cd ios && bundle exec pod install
```

## 3. 原生配置

安装完成后，还需要在原生侧完成 URL Scheme / AppDelegate / Manifest 配置才能接收分享回调：

- [iOS 原生配置](../native-setup/ios)
- [Android 原生配置](../native-setup/android)

## 下一步

- [快速上手](./quick-start) — 最小可运行 Demo
