# @unif/react-native-umeng

友盟 React Native SDK 接入，提供微信会话／钉钉分享、分享面板和应用统计。应用取得用户明确同意后，再初始化和使用 SDK。

[文档站](https://unif-design.github.io/react-native-umeng/) · [npm](https://www.npmjs.com/package/@unif/react-native-umeng) · [运行示例](example/README.md)

## 安装

| 项目         | 要求                                      |
| ------------ | ----------------------------------------- |
| React Native | `>=0.86.0`，启用新架构                    |
| React        | `>=19.2.3 <20.0.0`                        |
| 运行平台     | iOS / Android；Web 操作报告 `unsupported` |
| 真实分享     | 安装目标 App，并完成平台回调配置          |

```sh
yarn add @unif/react-native-umeng
```

按[安装指南](website/docs/getting-started/installation.md)补齐 Design 等 peer 依赖，完成 [iOS](website/docs/native-setup/ios.md) 或 [Android](website/docs/native-setup/android.md) 回调配置，再重新构建应用。

## 快速开始

下面的代码放在应用已取得真实隐私同意的流程中。将占位值替换为自己在友盟和钉钉平台登记的配置：

```ts
import { initializeUmeng, share } from '@unif/react-native-umeng';

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

| 分享 `status` | 含义与处理                                      |
| ------------- | ----------------------------------------------- |
| `success`     | 收到本次 SDK 成功回执，不代表业务已完成         |
| `cancelled`   | 本次分享已取消                                  |
| `failed`      | 读取 `error.reason`；不能据此断言外部分享未发生 |

初始化失败会抛出 `UmengError`。真实回包和 Universal Link 仍需在设备验证，模拟器或单测不能代替第三方 App 往返验收。

## 进一步使用

| 需要做什么           | 文档                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| 配置微信或仅使用统计 | [初始化 API](website/docs/api/common.md)                                      |
| 分享图片、链接或文字 | [分享 API](website/docs/api/share.md)                                         |
| 让用户选择分享平台   | [实例分享面板](website/docs/api/platform-sharesheethost.md)，需渲染本实例宿主 |
| 记录事件与统计用户   | [统计 API](website/docs/api/analytics.md)，同步交接，不代表云端接收           |

[独立应用接入示例](example/INTEGRATION.md) · [开发资料](docs/DEVELOPMENT.md) · [库能力技能](website/docs/skills.md) · [AI 文档索引](https://unif-design.github.io/react-native-umeng/llms.txt) · [MIT 许可](LICENSE)
