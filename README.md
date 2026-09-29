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
import { initializeUmeng, share } from '@unif/react-native-umeng';

// 应用已在此之前取得真实隐私同意。
await initializeUmeng({
  appKey: 'YOUR_UMENG_APPKEY',
  dingtalk: { appId: 'YOUR_DINGTALK_APP_ID' },
});
const result = await share({
  target: 'dingtalk',
  content: { type: 'text', text: '你好' },
});
if (result.status === 'failed') console.log(result.error.reason);
```

分享返回 `success`、`cancelled` 或 `failed`。`useShareSheet()` 返回本实例的控制器与需要渲染的宿主；统计操作为同步 `void` 交接。Web 入口不加载原生 SDK，操作明确报告 `unsupported`。

## 文档与开发

- [初始化](website/docs/api/common.md) · [分享](website/docs/api/share.md) · [分享面板](website/docs/api/platform-sharesheethost.md) · [统计](website/docs/api/analytics.md)
- [运行示例](example/README.md) · [独立应用接入示例](example/INTEGRATION.md)
- [开发资料与新版本契约](docs/DEVELOPMENT.md)
- [AI 文档索引](https://unif-design.github.io/react-native-umeng/llms.txt) · [研发技能](https://github.com/unif-skill/unif-portal-dev-skills)

真实分享需在安装了微信／钉钉的设备上验证；模拟器与单测不能证明第三方应用拉起、回包或 Universal Link 已可用。许可为 [MIT](LICENSE)。
