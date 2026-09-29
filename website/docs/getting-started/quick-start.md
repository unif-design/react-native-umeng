---
title: 快速上手
description: 授权后初始化，使用独立分享与实例面板。
---

# 快速上手

先完成[安装](./installation)、[iOS](../native-setup/ios) 或 [Android](../native-setup/android) 回调配置。

## 授权后初始化 {#initialize}

```ts
import { initializeUmeng, share } from '@unif/react-native-umeng';

// 放在应用真实取得隐私同意之后。
await initializeUmeng({
  appKey: 'YOUR_UMENG_APPKEY',
  dingtalk: { appId: 'YOUR_DINGTALK_APP_ID' },
});
const result = await share({
  target: 'dingtalk',
  content: { type: 'link', title: '应用介绍', url: 'https://example.com/' },
});
switch (result.status) {
  case 'success': break; // 本次 SDK 已确认
  case 'cancelled': break;
  case 'failed': console.log(result.error.reason); break;
}
```

应用只需要统计时可省略全部分享平台配置。微信配置的完整字段及初始化不可变语义见[初始化 API](../api/common)。

## 挂载本实例宿主 {#mount-host}

在需要分享的 React 组件调用 `useShareSheet()`，渲染返回的 `host`，调用 `controller.open(content, options)`。不要把普通页面的宿主当作图片预览模态的宿主；预览窗口使用自己的实例。完整代码见[实例分享面板](../api/platform-sharesheethost)。

Web 入口隔离原生模块，操作明确返回或抛出 `unsupported`。单测使用[官方 mock](../testing)，真实第三方回包在原生设备验证。
