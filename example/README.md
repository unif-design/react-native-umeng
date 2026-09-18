# Umeng 示例

按顺序体验初始化、平台检测、分享面板、直接分享与统计。

## 运行

从仓库根目录执行：

```sh
yarn install --immutable --mode=skip-build
yarn example start
```

iOS 首次运行或原生依赖变化后：

```sh
(cd example && bundle install)
(cd example && bundle exec pod install --project-directory=ios)
```

常规构建与完整测试由 CI 执行。开展真机测试时使用 `yarn example ios` 或 `yarn example android`，并按平台指南完成应用配置。

## 操作顺序

1. 在“运行时凭据”页填写测试配置；真实值不写入源码或日志。
2. 点击“预初始化”，仅保存本次配置。
3. 用户明确同意隐私协议后，点击初始化。
4. 查看微信／钉钉安装状态，再进入分享面板或直接分享。
5. 在 Analytics 页测试事件和统计用户标识。

分享只有成功才 resolve，取消和失败由 `UmengError` 区分。库 API 接受 HTTP／HTTPS URL，示例仅放行 HTTPS。

## 接入与验证

- [独立应用接入](INTEGRATION.md)：依赖、示例源码和原生回调模板。
- [iOS 配置](../website/docs/native-setup/ios.md) · [Android 配置](../website/docs/native-setup/android.md)
- [开发资料](../docs/DEVELOPMENT.md)：目标契约、源码与定向验证入口。

真实微信／钉钉回包需真机验证；iOS Universal Link／AASA 还需可访问的线上域名。静态接线检查不代表分享已成功。
