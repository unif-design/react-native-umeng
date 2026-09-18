# 独立应用接入 Umeng 示例

## 复制到独立消费者 App

[运行示例](README.md)中的命令只用于本仓 monorepo。独立消费者不要安装
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
