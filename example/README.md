# React Native Umeng Example 展厅

这个 RN 0.86.2 New Architecture app 用于手工验证 `@unif/react-native-umeng` 的两段式初始化、平台检测、分享、Analytics 与原生回调接线。它不是可发布应用，也不保存真实 appkey、secret、URL Scheme、Associated Domain 或 AASA 内容。

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

## 2. 运行时填写凭据

首次进入展厅的“运行时凭据”页，在**本机运行时**填写测试应用的 appkey、微信 App ID / App Secret、Universal Link 与钉钉 App ID；不要把真实值写入源码、测试、日志、截图或提交。展厅只显示预选的安全日志文案，不记录凭据或分享 payload。

启用微信时：

- iOS 要同时填写 `wechatAppId`、`wechatAppSecret` 和带 host 的绝对 HTTPS `wechatUniversalLink`。
- Android 要同时填写 `wechatAppId` 与 `wechatAppSecret`；Universal Link 可省略。

启用钉钉时填写 `dingtalkAppId`。库 API 接受绝对 HTTP/HTTPS URL；为避免把非安全链接带入展厅，example 默认只放行 HTTPS URL。

## 3. 预初始化

填写并校验后选择“预初始化”。展厅调用 `Common.preInit(config)`：它只在 JS 中校验、标准化并保存配置快照，不调用 native/vendor，也不注册平台或上报。所有凭据都必须在这个步骤提供。

## 4. 明示同意

确认用户已明确同意隐私协议后，选择“我已同意隐私协议并初始化”。展厅才会无参调用 `Common.init()`，从而进入 native/vendor 初始化。不要在同意前调用 `init()`，也不要重新传递或替换初始化配置。

## 5. 平台检测

初始化成功后进入“平台状态”，分别检查微信会话与钉钉是否安装。`Share.isInstalled(platform)` 的结果只表示当前设备可检测到对应 App；模拟器和未安装第三方 App 的设备不能证明真实分享链路。

## 6. openSheet / 直发

“分享面板”页调用 `Share.openSheet(payload, options)`，由 `ShareSheetHost` 展示可选平台；“直接分享”页调用 `Share.shareText`、`Share.shareImage` 或 `Share.shareLink`，跳过面板直发到选定平台。只有成功才 resolve；取消、失败和未安装平台都会以 `UmengError` reject，按界面反馈和安全日志排查，勿记录敏感 payload。

## 7. Analytics

“Analytics”页调用 `Analytics.onEvent`、`Analytics.signIn` 和 `Analytics.signOut`。它们都是同步 `void` API，不要 `await`；仍应在完成初始化后再触发，并仅使用适合测试的非敏感事件 / 用户标识。

## 8. iOS / Android 回调配置

iOS 的 [`Info.plist`](./ios/ReactNativeUmengExample/Info.plist) 只保留 `YOUR_...` 原生占位。真机前需在最终宿主配置 URL Types、`LSApplicationQueriesSchemes`、Associated Domains 和线上 AASA；AppDelegate / SceneDelegate 的 URL 与 Universal Link 入口必须同时转发给 `RCTLinkingManager` 与 Umeng handler，并合并两个结果。

Android 真机前需在最终宿主包名下保留 `.wxapi.WXEntryActivity` 与 `.ddshare.DDShareActivity` callback Activity，并配置对应平台凭据。不要在 callback Activity 硬编码 appId；授权后的 native 初始化从 `Common.preInit` 快照获得凭据。

真实微信 / 钉钉回包，以及 iOS Universal Link / AASA，只能在真机和线上域名验收；模拟器、Jest 或静态 contract 不能替代。

## 9. 自动化 / 真机矩阵

自动化门禁在仓库根目录执行：

```sh
yarn example test --maxWorkers=2
yarn verify:example-contract
node scripts/verify-native-contract.mjs --platform android
node scripts/verify-native-contract.mjs --platform ios
```

真机验收至少覆盖：iOS 微信 / 钉钉拉起与回包、URL Scheme、Universal Link 和线上 AASA；Android 微信 / 钉钉拉起与回包、callback Activity 与启用 R8 的 release 运行。自动化可证明 JS、原生接线和构建 contract，不能冒充第三方 App 的真实平台结果。
