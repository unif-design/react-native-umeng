# @unif/react-native-umeng

[![npm](https://img.shields.io/npm/v/@unif/react-native-umeng.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-umeng)
[![CI](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-umeng.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-umeng/)

友盟 React Native bridge：U-Share（微信会话 / 钉钉）+ U-App 移动统计。Unif 私有。

> 📖 **完整文档**（安装 · iOS/Android 原生配置 · API · 错误码 · PIPL 合规）：
> **https://unif-design.github.io/react-native-umeng/**

## 安装

```sh
yarn add @unif/react-native-umeng @unif/react-native-design @gorhom/bottom-sheet react-native-gesture-handler react-native-svg
```

iOS 需 `pod install`。原生回调注册（微信 / 钉钉 URL Scheme、AppDelegate、Android 回调 Activity、Universal Link）较多，**完整步骤见[文档站 · 原生配置](https://unif-design.github.io/react-native-umeng/docs/native-setup/ios)**。

## 用法

```tsx
import { Common, Share, ShareSheetHost } from '@unif/react-native-umeng';

// 1. App 启动预初始化（隐私协议前；不上报）
await Common.preInit({ appkey: 'YOUR_APPKEY', wechatAppId: 'wx…', dingtalkAppId: 'dingoa…' });
// 2. 用户同意《隐私协议》后正式启动采集
await Common.init();
// 3. 命令式分享面板（需在 App 根挂 <ShareSheetHost />）
const r = await Share.openSheet({ type: 'link', title: '标题', url: 'https://example.com' });
// r.code: 'success' | 'cancel' | 'failed'
```

直拉 `Share.shareLink`、统计 `Analytics`、错误码、PIPL 合规 —— 见[文档站](https://unif-design.github.io/react-native-umeng/)。

## License

MIT
