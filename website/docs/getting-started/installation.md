---
sidebar_position: 1
title: 安装
description: "安装 @unif/react-native-umeng 的 10 个 peerDependencies，配置 react-native-worklets/plugin，并进入 Android 当前接入与 iOS remediation 目标。"
---

# 安装

装齐 `@unif/react-native-umeng` 的同伴包,配置 Android 当前接入,并了解尚待完成的 iOS remediation。**分享面板的 UI 依赖 `@unif/react-native-design`,peerDeps 缺失会在解析或运行时失败** —— 本页以 `package.json` 的 `peerDependencies` 为准逐项列出。

## 环境要求

| 要求 | 版本 |
| --- | --- |
| React Native | **0.85+**(仅新架构 Fabric + TurboModules) |
| React | 19+ |
| iOS | **当前整改分支未完成**;等待 native `initialize` / Pod module / Codegen Task 9 |
| Android | minSdk 24;其余由 RN 与锁定的友盟 SDK 决定 |

:::info 仅支持新架构
本库是 TurboModule 桥,**仅支持 React Native 0.85+ 新架构**。旧架构(Bridge)不在目标范围。
:::

---

## 1. 安装依赖 {#安装依赖}

`package.json` 当前声明 **10 个 peers**。RN 工程已经提供 `react` / `react-native`;其余 8 个必须显式安装:

```sh
yarn add @unif/react-native-umeng \
  @sbaiahmed1/react-native-blur \
  @unif/react-native-design \
  react-native-gesture-handler \
  react-native-reanimated \
  react-native-reanimated-carousel \
  react-native-safe-area-context \
  react-native-svg \
  react-native-worklets
```

各包的作用与版本约束:

| 包 | 版本约束 | 作用 |
| --- | --- | --- |
| `@sbaiahmed1/react-native-blur` | `>=4` | design 根入口的静态依赖 |
| `@unif/react-native-design` | `^0.20.0` | 分享面板 UI(`Cell` / `Button` / `useThemedStyles`) |
| `react` | `*` | RN 工程已有 |
| `react-native` | `*` | RN 工程已有;本仓 fixture 使用 RN 0.85 |
| `react-native-gesture-handler` | `>=3.0.0 <4.0.0` | design 手势底层与 ShareSheet Modal 内部 root |
| `react-native-reanimated` | `^4.5.3` | design 根入口运行时依赖 |
| `react-native-reanimated-carousel` | `>=5.0.0 <6.0.0` | design 根入口静态依赖 |
| `react-native-safe-area-context` | `>=5` | design 根入口静态依赖 |
| `react-native-svg` | `>=15` | 面板平台图标与 design 图标 |
| `react-native-worklets` | `^0.11.3` | Reanimated / design 运行时与 Babel 转换 |

范围以安装版本的 `package.json#peerDependencies` 为唯一真相源,不要从旧文档猜版本。

### Worklets Babel plugin(React Native App 必配) {#worklets-babel}

在宿主 React Native App 的 `babel.config.js` 中把 Worklets plugin 放在 `plugins` **最后**:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // 其它 plugin ...
    'react-native-worklets/plugin',
  ],
};
```

Docusaurus website 不需要为此新增 Babel 配置;这一要求只针对 Metro 消费者。

:::warning `@unif/react-native-design` 是分享面板的 UI 壳,不能省
`<ShareSheetHost />` 面板本体是 RN `Modal` 底部弹层,内部用 design 的 `Cell` / `Button` / `useThemedStyles` 渲染,因此 Host 必须位于 design 的 `ThemeProvider` 内。Host 已在 **Modal 内容内部**创建 `GestureHandlerRootView`;App 外层的同名 root 不能跨越 Modal 的独立 native root,也不能替代这一内部边界。挂载约定见[快速上手](./quick-start)。
:::

:::note 只用统计、不用分享?
即使如此,`@unif/react-native-design` 等仍是 `peerDependencies`(非可选),包管理器会要求安装齐全。统计(`Analytics.*`)本身不依赖 design,但建议按上表装齐以避免 peer 告警。
:::

---

## 2. iOS:pod install

安装或升级依赖后,最终 iOS 实现仍需执行 `pod install`:

```sh
cd ios && bundle exec pod install
```

:::danger 当前分支的 iOS 还不能按本文验收
JS 已调用 `NativeUmengCommon.initialize(config)`,但当前 `ios/UmengCommon.mm` 仍实现旧的 native `preInit/init`;Pod module 与 Codegen modules provider 也未完成。单独运行 `pod install` 不能消除这组契约不匹配。等待 iOS remediation Task 9 落地并通过 Pod/Codegen/build 后,再用本页 iOS 目标配置接入。
:::

:::warning 模拟器只能验编译与 JS/native 逻辑
模拟器没有真微信 / 钉钉,不能完成真实分享回跳;最终链路必须真机验收。但模拟器 build 本身是 iOS remediation 的 CI 验收项,**编译失败不能笼统归为“模拟器预期限制”**。
:::

---

## 3. Android

Android 端依赖随 Gradle 自动同步,无需手动 link。直接 `npx react-native run-android` 即可编译。

> 微信 / 钉钉的分享回调 Activity 需要落在宿主包名下,见下一步原生配置。

---

## 4. 原生回调配置(必做)

分享后能否跳回 App,完全取决于原生侧的 URL Scheme / 回调 Activity 注册。**模板不要凭记忆编**,按对应平台文档逐项配置:

- [iOS 原生配置](../native-setup/ios) —— `Info.plist` 的 `LSApplicationQueriesSchemes` / `CFBundleURLTypes`,`AppDelegate` 转发 `handleOpen(_:options:)`,微信 Universal Link。
- [Android 原生配置](../native-setup/android) —— `WXEntryActivity` / `DDShareActivity` 必须在**宿主包名**下并直接继承 SDK 回调基类;Activity 不硬编码凭据。

> 友盟 `appkey` / `appsecret` / Universal Link 等都通过 JS `Common.preInit(config)` 传,**不写在 Info.plist / Gradle**。

---

## 下一步

- [快速上手](./quick-start) —— 5 分钟跑通初始化 + 第一次分享
- [指南 → 隐私合规(PIPL)](../guides/privacy-pipl) —— preInit / init 两段式时序
- [API 参考 → Common](../api/common) —— preInit / init / isInited 完整参数
