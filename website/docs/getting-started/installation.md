---
sidebar_position: 1
title: 安装
description: "安装 @unif/react-native-umeng 及全部 peerDependencies（@unif/react-native-design、@gorhom/bottom-sheet、react-native-gesture-handler、react-native-svg），运行 pod install，并指向 iOS / Android 原生回调配置。"
---

# 安装

装齐 `@unif/react-native-umeng` 的同伴包,完成 iOS 编译,再做一步原生回调配置。**分享面板的 UI 依赖 `@unif/react-native-design`,peerDeps 缺一即崩** —— 本页以 `package.json` 的 `peerDependencies` 为准逐项列出。

## 环境要求

| 要求 | 版本 |
| --- | --- |
| React Native | **0.85+**(仅新架构 Fabric + TurboModules) |
| React | 19+ |
| iOS | 由友盟 U-Share / U-App SDK 决定 |
| Android | 由友盟 U-Share / U-App SDK 决定 |

:::info 仅支持新架构
本库是 TurboModule 桥,**仅支持 React Native 0.85+ 新架构**。旧架构(Bridge)不在目标范围。
:::

---

## 1. 安装依赖 {#安装依赖}

以下同伴包**全部必装**(以 `package.json` 的 `peerDependencies` 为准):

```sh
yarn add @unif/react-native-umeng \
  @unif/react-native-design \
  @gorhom/bottom-sheet \
  react-native-gesture-handler \
  react-native-svg
```

各包的作用与版本约束:

| 包 | 版本约束 | 作用 |
| --- | --- | --- |
| `@unif/react-native-design` | `>=0.1.2` | 分享面板 UI(`BottomSheet` / `Cell` / `Button` / `useTheme`),**必装**(见下) |
| `@gorhom/bottom-sheet` | `>=5` | 分享面板底层 BottomSheet |
| `react-native-gesture-handler` | `>=2.21.0` | BottomSheet 手势 |
| `react-native-svg` | `>=15` | 面板平台图标 |

> `react` / `react-native` 也声明为 peer(`*`),任何 RN 工程都已自带,无需为本库单独安装。

:::warning `@unif/react-native-design` 是分享面板的 UI 壳,不能省
`<ShareSheetHost />` 用 design 的 `BottomSheet` / `Cell` / `Button` / `useTheme` 渲染,并且**必须在 design 的 `ThemeProvider` 与 `GestureHandlerRootView` 内**才能工作。这套挂载约定见[快速上手](./quick-start)。缺 design 或缺 `ThemeProvider`,分享面板无法渲染。
:::

:::note 只用统计、不用分享?
即使如此,`@unif/react-native-design` 等仍是 `peerDependencies`(非可选),包管理器会要求安装齐全。统计(`Analytics.*`)本身不依赖 design,但建议按上表装齐以避免 peer 告警。
:::

---

## 2. iOS:pod install

安装或升级依赖后,**必须重新执行 pod install**:

```sh
cd ios && bundle exec pod install
```

完成后用 Xcode 或 `npx react-native run-ios` 重新编译运行。

:::warning 模拟器跑不起分享
友盟 U-Share 在 Apple Silicon Mac 模拟器上有 `EXCLUDED_ARCHS=arm64` 限制,且模拟器没有真微信 / 钉钉。**分享一律真机验证**,详见[常见问题](../troubleshooting)。
:::

---

## 3. Android

Android 端依赖随 Gradle 自动同步,无需手动 link。直接 `npx react-native run-android` 即可编译。

> 微信 / 钉钉的分享回调 Activity 需要落在宿主包名下,见下一步原生配置。

---

## 4. 原生回调配置(必做)

分享后能否跳回 App,完全取决于原生侧的 URL Scheme / 回调 Activity 注册。**模板不要凭记忆编**,按对应平台文档逐项配置:

- [iOS 原生配置](../native-setup/ios) —— `Info.plist` 的 `LSApplicationQueriesSchemes` / `CFBundleURLTypes`,`AppDelegate` 转发 `handleOpen(_:options:)`,微信 Universal Link。
- [Android 原生配置](../native-setup/android) —— `WXEntryActivity` / `DDShareActivity` 必须在**宿主包名**下,钉钉 `appId` 与 JS 侧 `preInit({ dingtalkAppId })` 一致。

> 友盟 `appkey` / `appsecret` / Universal Link 等都通过 JS `Common.preInit(config)` 传,**不写在 Info.plist / Gradle**。

---

## 下一步

- [快速上手](./quick-start) —— 5 分钟跑通初始化 + 第一次分享
- [指南 → 隐私合规(PIPL)](../guides/privacy-pipl) —— preInit / init 两段式时序
- [API 参考 → Common](../api/common) —— preInit / init / isInited 完整参数
