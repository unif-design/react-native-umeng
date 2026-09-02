# React Native Umeng Example 展厅

这个 RN 0.86.3 New Architecture app 使用 Design 0.30.0 与 Blur 6.0.1，用于手工验证 `@unif/react-native-umeng` 的两段式初始化、平台检测、分享、Analytics 与原生回调接线。它不是可发布应用，也不保存真实 appkey、secret、URL Scheme、Associated Domain 或 AASA 内容。

## 1. 安装依赖

在仓库根目录安装锁定依赖：

```sh
yarn install --immutable
```

启动 Metro：

```sh
yarn example start
```

另开一个终端运行目标平台：

```sh
yarn example ios
```

或：

```sh
yarn example android
```

iOS 依赖变更后，从仓库根目录执行：

```sh
cd example/ios
bundle exec pod install
```

## 2. 复制到独立消费者 App

上一节命令只用于本仓 monorepo。独立消费者不要安装
[`example/package.json`](./package.json) 中的
`@unif/react-native-umeng: workspace:*`；`workspace:*` 仅用于本仓。请在消费者
App 根目录从 npm 公共入口安装 library、Design 和除 React / React Native 外的全部
peer dependencies：

```sh
yarn add @unif/react-native-umeng \
  '@sbaiahmed1/react-native-blur@>=4' \
  '@unif/react-native-design@>=0.26.0' \
  'react-native-gesture-handler@>=3.0.0 <4.0.0' \
  'react-native-reanimated@>=4.5.3 <4.7.0' \
  'react-native-reanimated-carousel@>=5.0.0 <6.0.0' \
  'react-native-safe-area-context@>=5' \
  'react-native-svg@>=15' \
  'react-native-worklets@>=0.11.3 <0.13.0'
```

React 与 React Native 由消费者宿主提供；本 example 验证的组合见仓库
[`package.json`](../package.json)。把 `react-native-worklets/plugin` 合并到消费者
`babel.config.js` 的 `plugins`，并保持为最后一项。

npm 包不发布 example。先在本地 clone 本仓库，然后在消费者 App 根目录只复制
[`example/src`](./src/)：

```sh
mkdir -p src/umeng-showcase
cp -R /absolute/path/to/react-native-umeng/example/src/. src/umeng-showcase/
```

临时入口可以渲染复制后的 `App`：

```tsx
import UmengShowcase from './src/umeng-showcase/App';
```

不要复制 monorepo 的 `example/package.json`、`metro.config.js`、
`react-native.config.js` 或整份 `babel.config.js`；只把上述 plugin 合并到宿主。
[`example/src`](./src/) 只通过 npm 公共入口和目录内相对路径导入。下面的 native
文件是接线模板，需合并到消费者现有工程，不能用 example 工程文件整体覆盖宿主。

### iOS 消费者接线

参考 example 的 [`Info.plist`](./ios/ReactNativeUmengExample/Info.plist)、
[`AppDelegate.swift`](./ios/ReactNativeUmengExample/AppDelegate.swift)、
[`SceneDelegateFixture.swift`](./ios/ReactNativeUmengExample/SceneDelegateFixture.swift)
和
[`ReactNativeUmengExample.entitlements`](./ios/ReactNativeUmengExample/ReactNativeUmengExample.entitlements)，
并逐项完成 [iOS native setup](../website/docs/native-setup/ios.md)：

- URL Scheme 使用平台登记的原值，不额外拼接 `wx` 或 `dingoa`。
- AppDelegate / SceneDelegate 的 URL 与 Universal Link callback 都要分别调用
  Umeng handler 和 `RCTLinkingManager`，最后合并两个结果；不要用短路表达式漏掉任一
  handler。`SceneDelegateFixture.swift` 只是编译 fixture，应把方法合并到真实且已注册
  lifecycle 的 SceneDelegate，不要整文件覆盖。
- Associated Domains entitlement 写成 `applinks:links.example.com`，不含 scheme 或
  path。AASA 部署在
  `https://links.example.com/.well-known/apple-app-site-association`，必须使用
  HTTPS 且不得重定向；AASA 的 `appID` 使用 `TEAM_ID.BUNDLE_ID`。
- `wechatUniversalLink` 的 path 必须被 AASA paths / components 覆盖，其 domain
  必须与 entitlement host 一致。

合并 native 配置后安装 Pods：

```sh
cd ios
bundle exec pod install
```

### Android 消费者接线

复制完整双平台展厅时，按 example 的
[`app/build.gradle`](./android/app/build.gradle) 在消费者 app module 添加四项
compile dependency：

```gradle
implementation("com.umeng.umsdk:share-wx:7.3.7")
implementation("com.tencent.mm.opensdk:wechat-sdk-android:6.8.34")
implementation("com.umeng.umsdk:share-dingding:7.3.7")
implementation("com.alibaba.android:ddsharesdk:1.2.2")
```

并按 example 的
[`gradle.properties`](./android/gradle.properties) 启用 Jetifier：

```properties
android.enableJetifier=true
```

把
[`WXEntryActivity.kt`](./android/app/src/main/java/unif/reactnativeumeng/example/wxapi/WXEntryActivity.kt)
和
[`DDShareActivity.kt`](./android/app/src/main/java/unif/reactnativeumeng/example/ddshare/DDShareActivity.kt)
分别放到最终 `applicationId` 对应的 `.wxapi` 与 `.ddshare` package，并修改 Kotlin
`package`；Activity 内不要写 appId 或 secret。library Manifest 会自动合并 disabled
callback Activity，宿主不要重复声明 callback Activity。完整要求和单平台依赖裁剪见
[Android native setup](../website/docs/native-setup/android.md)。

静态 contract、Jest 和模拟器不能证明真实平台链路；真实微信 / 钉钉回包必须在安装了
对应第三方 App 的真机验收，Universal Link / AASA 还必须使用可访问的线上域名。

## 3. 运行时填写凭据

首次进入展厅的“运行时凭据”页，在**本机运行时**填写测试应用的 appkey、微信 App ID / App Secret、Universal Link 与钉钉 App ID；不要把真实值写入源码、测试、日志、截图或提交。展厅只显示预选的安全日志文案，不记录凭据或分享 payload。

启用微信时：

- iOS 要同时填写 `wechatAppId`、`wechatAppSecret` 和带 host 的绝对 HTTPS `wechatUniversalLink`。
- Android 要同时填写 `wechatAppId` 与 `wechatAppSecret`；Universal Link 可省略。

启用钉钉时填写 `dingtalkAppId`。库 API 接受绝对 HTTP/HTTPS URL；为避免把非安全链接带入展厅，example 默认只放行 HTTPS URL。

## 4. 预初始化

填写并校验后选择“预初始化”。展厅调用 `Common.preInit(config)`：它只在 JS 中校验、标准化并保存配置快照，不调用 native/vendor，也不注册平台或上报。所有凭据都必须在这个步骤提供。

## 5. 明示同意

确认用户已明确同意隐私协议后，选择“我已同意隐私协议并初始化”。展厅才会无参调用 `Common.init()`，从而进入 native/vendor 初始化。不要在同意前调用 `init()`，也不要重新传递或替换初始化配置。

## 6. 平台检测

初始化成功后进入“平台状态”，分别检查微信会话与钉钉是否安装。`Share.isInstalled(platform)` 的结果只表示当前设备可检测到对应 App；模拟器和未安装第三方 App 的设备不能证明真实分享链路。

## 7. openSheet / 直发

“分享面板”页调用 `Share.openSheet(payload, options)`，由 `ShareSheetHost` 展示可选平台；“直接分享”页调用 `Share.shareText`、`Share.shareImage` 或 `Share.shareLink`，跳过面板直发到选定平台。只有成功才 resolve；取消、失败和未安装平台都会以 `UmengError` reject，按界面反馈和安全日志排查，勿记录敏感 payload。

## 8. Analytics

“Analytics”页调用 `Analytics.onEvent`、`Analytics.signIn` 和 `Analytics.signOut`。它们都是同步 `void` API，不要 `await`；仍应在完成初始化后再触发，并仅使用适合测试的非敏感事件 / 用户标识。

## 9. iOS / Android 回调配置

iOS 的 [`Info.plist`](./ios/ReactNativeUmengExample/Info.plist) 只保留 `YOUR_...` 原生占位。真机前需在最终宿主配置 URL Types、`LSApplicationQueriesSchemes`、Associated Domains 和线上 AASA；AppDelegate / SceneDelegate 的 URL 与 Universal Link 入口必须同时转发给 `RCTLinkingManager` 与 Umeng handler，并合并两个结果。

Android 真机前需在最终宿主包名下保留 `.wxapi.WXEntryActivity` 与 `.ddshare.DDShareActivity` callback Activity，并配置对应平台凭据。不要在 callback Activity 硬编码 appId；授权后的 native 初始化从 `Common.preInit` 快照获得凭据。

真实微信 / 钉钉回包，以及 iOS Universal Link / AASA，只能在真机和线上域名验收；模拟器、Jest 或静态 contract 不能替代。

## 10. 自动化 / 真机矩阵

自动化门禁在仓库根目录执行：

```sh
yarn example test --maxWorkers=2
yarn verify:example-contract
node scripts/verify-native-contract.mjs --platform android
node scripts/verify-native-contract.mjs --platform ios
```

真机验收至少覆盖：iOS 微信 / 钉钉拉起与回包、URL Scheme、Universal Link 和线上 AASA；Android 微信 / 钉钉拉起与回包、callback Activity 与启用 R8 的 release 运行。自动化可证明 JS、原生接线和构建 contract，不能冒充第三方 App 的真实平台结果。
