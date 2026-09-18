# @unif/react-native-umeng

友盟 React Native SDK 接入，提供微信会话／钉钉分享、分享面板和应用统计。

[文档站](https://unif-design.github.io/react-native-umeng/) · [npm](https://www.npmjs.com/package/@unif/react-native-umeng) · [示例](example/README.md)

## 安装

```sh
yarn add @unif/react-native-umeng
```

继续按[安装指南](website/docs/getting-started/installation.md)补齐 peer 依赖，再完成 [iOS](website/docs/native-setup/ios.md) 或 [Android](website/docs/native-setup/android.md) 的第三方平台回调配置。

## 快速开始

应用准备自己的测试配置；取得用户明确同意后再初始化和使用 SDK：

```ts
import { Common, Platform, Share } from '@unif/react-native-umeng';

await Common.preInit({
  appkey: 'YOUR_UMENG_APPKEY',
  dingtalkAppId: 'YOUR_DINGTALK_APP_ID',
});

// 此处由应用完成用户同意流程，再调用 init。
await Common.init();

try {
  await Share.shareText({ platform: Platform.DINGTALK, text: '你好' });
} catch (error) {
  // 按 UmengError 区分用户取消、未安装和其他失败。
}
```

`preInit` 只保存配置，`init` 才进入原生 SDK。分享成功时 resolve，取消或失败时 reject；统计 API 是同步 `void` 调用。需要平台选择面板时使用 `Share.openSheet` 并接入 `ShareSheetHost`。

## 文档与开发

- [初始化](website/docs/api/common.md) · [分享](website/docs/api/share.md) · [分享面板](website/docs/api/platform-sharesheethost.md) · [统计](website/docs/api/analytics.md)
- [运行示例](example/README.md) · [独立应用接入示例](example/INTEGRATION.md)
- [开发资料与新版本契约](docs/DEVELOPMENT.md)
- [AI 文档索引](https://unif-design.github.io/react-native-umeng/llms.txt) · [研发技能](https://github.com/unif-skill/unif-portal-dev-skills)

真实分享需在安装了微信／钉钉的设备上验证；模拟器与单测不能证明第三方应用拉起、回包或 Universal Link 已可用。许可为 [MIT](LICENSE)。
