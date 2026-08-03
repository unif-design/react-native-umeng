# React Native Umeng Example

这个 RN 0.85 New Architecture app 用来验证 `@unif/react-native-umeng` 的初始化、分享、统计与原生回调接线。它不是可直接发布的应用；仓库中的 appkey、secret、URL Scheme 与 Associated Domain 都是明显占位符。

## 准备

在仓库根目录安装依赖：

```sh
yarn
```

把 [`src/App.tsx`](./src/App.tsx) 中的 `UMENG_CONFIG` 替换为测试应用的真实凭据。字段规则：

- `appkey` 必填。
- iOS 启用微信时，`wechatAppId`、`wechatAppSecret`、带 host 的绝对 HTTPS `wechatUniversalLink` 必须同时提供。
- Android 启用微信时，`wechatAppId` 与 `wechatAppSecret` 必须同时提供；Universal Link 可省略。
- 钉钉只需 `dingtalkAppId`。

同时按文档完成原生占位替换：

- [iOS 原生配置](../website/docs/native-setup/ios.md)：URL Types 使用平台分配原值，配置 Associated Domains/AASA。
- [Android 原生配置](../website/docs/native-setup/android.md)：在最终宿主包名的 `.wxapi` / `.ddshare` 下提供两个 callback Activity。

## 运行

终端一，从仓库根启动 Metro：

```sh
yarn example start
```

终端二运行平台：

```sh
yarn example ios
```

或：

```sh
yarn example android
```

iOS 依赖变化后先安装 Pods：

```sh
cd example/ios
bundle exec pod install
```

## 验证流程

1. App 挂载时自动调用 `Common.preInit(UMENG_CONFIG)`。这一步发生在模拟授权之前，只在 JS 校验、标准化并缓存配置，零 native/vendor 调用。
2. 界面显示“等待隐私授权”后，点击“我已同意隐私协议并初始化”。只有此按钮会调用无参 `Common.init()`。
3. 初始化成功后，分享与统计按钮才会启用。
4. 分享成功显示 `success@platform`；取消、失败或未安装平台显示对应 `UmengError.code`。

## 验证边界

- iOS simulator build、native contract、TurboModule provider 与 XCTest 已有通过证据。
- 模拟器没有真实微信 / 钉钉，不能证明平台拉起、回包、URL Scheme 或 Universal Link/AASA。
- Android Gradle SDK build、真实回跳与启用 R8 的 minified release 仍需在具备 Android SDK 的环境和真机执行。
- `Analytics.*` 是同步 `void`，示例不会 `await`；init 前 native 会 no-op。
