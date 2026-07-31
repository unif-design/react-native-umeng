# @unif/react-native-umeng

[![npm](https://img.shields.io/npm/v/@unif/react-native-umeng.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-umeng)
[![CI](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-umeng.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-umeng/)

友盟 React Native 新架构桥：**U-Share**（微信会话 / 钉钉分享）+ **U-App** 移动统计。面向 RN 0.85 新架构（TurboModule）。Unif 私有。

> **当前整改分支状态:** JS 公共层与 Android 已实现下述新契约。iOS native 仍导出旧的 `preInit/init`,与 JS Codegen spec 的 `initialize(config)` 不匹配;在 iOS remediation Task 9 完成并通过 Pod/Codegen/build 验证前,**不得把 iOS 视为已支持**。文档中的 iOS 原生配置以已批准整改目标标注。

## 特性

- **U-Share** — 微信会话 + 钉钉分享，支持文本 / 图片 / 链接三种内容。
- **命令式分享面板** — 根上挂一次 `<ShareSheetHost />`，`Share.openSheet()` 即可拉起，RN `Modal` 底部弹层 + `@unif/react-native-design` 组件渲染。
- **U-App 统计** — `onEvent` 自定义事件 + `signIn` / `signOut` 账号埋点。
- **PIPL 合规** — 两段式初始化（`preInit` 只存 JS 配置快照、零 native 调用 → 用户同意后 `init` 才完成平台配置并采集）。
- **TypeScript 优先** — 全量类型 + `UmengError` 错误码，随包附带官方 Jest mock。

> 首版只支持微信会话 + 钉钉，朋友圈 / QQ / 微博暂不支持。

## 安装

```sh
yarn add @unif/react-native-umeng \
  @sbaiahmed1/react-native-blur \
  @unif/react-native-design \
  react-native-gesture-handler \
  react-native-reanimated \
  react-native-reanimated-carousel \
  react-native-safe-area-context \
  react-native-svg \
  react-native-worklets
```

包共声明 10 个 peers;`react` / `react-native` 由 RN 工程提供,其余 8 个如上全部安装。React Native Babel 还必须把 `react-native-worklets/plugin` 放在 plugins 最后。完整范围与原生步骤见[安装文档](https://unif-design.github.io/react-native-umeng/docs/getting-started/installation)。

## 快速开始

根组件挂一次 `<ShareSheetHost />`,并保证它位于 `<ThemeProvider>` 内。下面外层的 `<GestureHandlerRootView>` 服务于 App 其余 RNGH 内容;`ShareSheetHost` 自己会在 RN `Modal` 的独立 native root 内再包一层,外层不能替代 Modal 内部边界：

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import { Common, Share, ShareSheetHost, UmengError } from '@unif/react-native-umeng';

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Screen />
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// 1. App 启动只保存 JS 配置快照（隐私协议前，零 native 调用）
await Common.preInit({
  appkey: 'YOUR_APPKEY',
  wechatAppId: 'YOUR_WECHAT_APP_ID',
  wechatAppSecret: 'YOUR_WECHAT_APP_SECRET',
  wechatUniversalLink: 'https://your.host/',
  dingtalkAppId: 'YOUR_DINGTALK_APP_ID',
});
// 2. 用户同意《隐私协议》后正式启动采集；init 无参
await Common.init();

// 3. 拉起分享面板 —— 取消 / 失败都 reject，只有成功才 resolve，所以用 try/catch
try {
  const r = await Share.openSheet({ type: 'link', title: '标题', url: 'https://example.com' });
  // r.code === 'success'
} catch (e) {
  if (e instanceof UmengError && e.code === 'E_USER_CANCEL') { /* 用户取消 */ }
}
```

底层直拉 `Share.shareLink`、统计 `Analytics.onEvent`、错误码、PIPL 合规细节 —— 见下方文档。

## 文档

- 文档站：<https://unif-design.github.io/react-native-umeng/>（安装 · iOS/Android 原生配置 · API · 错误码 · PIPL 合规）
- AI 索引：<https://unif-design.github.io/react-native-umeng/llms.txt> · 全文：<https://unif-design.github.io/react-native-umeng/llms-full.txt>
- AI 编码助手用 [`umeng-share`](https://github.com/unif-design/skills) Skill（含验证过的 API / 坑 / 原生 setup）。

## 兼容性

仅支持 **RN 0.85 新架构**（New Architecture / TurboModule）、React 19。当前整改分支 Android 已实现;Web 不支持;iOS 等待 Task 9 完成 native `initialize`、Pod module 与 Codegen registration 后再恢复支持声明。

## License

MIT
