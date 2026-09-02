---
sidebar_position: 1
title: 安装
description: "用 Yarn 安装 @unif/react-native-umeng 的 10 个 peerDependencies，配置最后一项 react-native-worklets/plugin，并完成 Android/iOS 原生接线。"
---

# 安装

装齐 `@unif/react-native-umeng` 的同伴包并完成 Android/iOS 原生接线。**分享面板的 UI 依赖 `@unif/react-native-design`,peerDeps 缺失会在解析或运行时失败** —— 本页以当前 `package.json#peerDependencies` 为准逐项列出。

## 环境要求

| 要求 | 版本 |
| --- | --- |
| React Native | 当前只验证 **0.85 New Architecture**(Fabric + TurboModules) |
| React | 当前验证 19 |
| iOS | RN 0.85 最低系统要求;仓库 simulator build/XCTest 已通过 |
| Android | minSdk 24;Gradle SDK build 与真机矩阵须在具备 Android SDK 的环境验证 |

:::info 仅支持新架构
本库是 TurboModule 桥,当前验证 **React Native 0.86.3 New Architecture**。旧架构(Bridge)不在目标范围；公开 peer 仍兼容 RN 0.86 的已验证组合。
:::

---

## 1. 安装依赖 {#安装依赖}

`package.json` 当前声明 **10 个 peers**。RN 工程已经提供 `react` / `react-native`;其余 8 个必须显式安装:

```sh
yarn add @unif/react-native-umeng \
  '@sbaiahmed1/react-native-blur@6.0.1' \
  '@unif/react-native-design@^0.30.0' \
  'react-native-gesture-handler@>=3.0.0 <4.0.0' \
  'react-native-reanimated@^4.6.0' \
  'react-native-reanimated-carousel@>=5.0.0 <6.0.0' \
  'react-native-safe-area-context@>=5' \
  'react-native-svg@>=15' \
  'react-native-worklets@^0.12.1'
```

各包的作用与版本约束:

| 包 | 版本约束 | 作用 |
| --- | --- | --- |
| `@sbaiahmed1/react-native-blur` | `>=4` | design 根入口的静态依赖 |
| `@unif/react-native-design` | `>=0.26.0` | 分享面板 UI(`Cell` / `Button` / `useThemedStyles`) |
| `react` | `*` | RN 工程已有 |
| `react-native` | `>=0.86.0` | RN 工程已有;本仓当前验证基线为 RN 0.86.3 |
| `react-native-gesture-handler` | `>=3.0.0 <4.0.0` | design 手势底层与 ShareSheet Modal 内部 root |
| `react-native-reanimated` | `>=4.5.3 <4.7.0` | design 根入口运行时依赖;当前验证 4.6.x |
| `react-native-reanimated-carousel` | `>=5.0.0 <6.0.0` | design 根入口静态依赖 |
| `react-native-safe-area-context` | `>=5` | design 根入口静态依赖 |
| `react-native-svg` | `>=15` | 面板平台图标与 design 图标 |
| `react-native-worklets` | `>=0.11.3 <0.13.0` | Reanimated / design 运行时与 Babel 转换;当前验证 0.12.x |

范围以安装版本的 `package.json#peerDependencies` 为唯一真相源,不要从旧文档猜版本。

:::note RNGH 3 + Carousel 5 的窄 peer 例外
当前 design 0.20 组合使用 RNGH 3 与 Carousel 5。Carousel 5 发布 metadata 的 RNGH peer 为 `>=2.9 <3`,与当前组合没有交集,但仓库已通过 scoped override、窄 allowlist 与漂移检查管理该已验证例外。不要为了清掉 warning 降级 RNGH,也不要使用全局 override、`--force` 或 `--legacy-peer-deps`;Carousel 或 RNGH major 变化时再重新评估。
:::

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

安装或升级依赖后执行 `pod install`:

```sh
cd ios && bundle exec pod install
```

:::info iOS 已验证与待验边界
仓库已验证 `ReactNativeUmeng` module、三个 Codegen modulesProvider、simulator build 与 XCTest。消费者仍需在自己的 Pod 图和宿主 target 重新执行 build；真实微信 / 钉钉 App、URL Scheme 与 Universal Link/AASA 只能在带真实凭据的真机验收。
:::

:::warning 模拟器只能验编译与 JS/native 逻辑
模拟器没有真微信 / 钉钉,不能完成真实分享回跳;最终链路必须真机验收。模拟器 build/XCTest 仍是独立门禁,**编译失败不能笼统归为“模拟器预期限制”**。
:::

---

## 3. Android

Android 端依赖随 Gradle 自动同步,无需手动 link。使用项目已有的 Yarn Android script 编译，例如 `yarn android`。

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

## 官方参考

- [Reanimated 4 Getting started](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/) —— New Architecture、独立安装 Worklets、Community CLI plugin 与“必须最后”
- [Migrating from Reanimated 3.x to 4.x](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/) —— Reanimated 4 的 Worklets 依赖与 Babel plugin 迁移说明
