# @unif/react-native-umeng

[![npm](https://img.shields.io/npm/v/@unif/react-native-umeng.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-umeng)
[![CI](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-umeng.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-umeng/)

友盟 React Native 新架构桥：**U-Share**（微信会话 / 钉钉分享）+ **U-App** 移动统计。面向 RN 0.85 新架构（TurboModule）。Unif 私有。

## 特性

- **U-Share** — 微信会话 + 钉钉分享，支持文本 / 图片 / 链接三种内容。
- **命令式分享面板** — 根上挂一次 `<ShareSheetHost />`，`Share.openSheet()` 即可拉起，基于 `@unif/react-native-design` 的 BottomSheet 渲染。
- **U-App 统计** — `onEvent` 自定义事件 + `signIn` / `signOut` 账号埋点。
- **PIPL 合规** — 两段式初始化（`preInit` 存配置不上报 → 用户同意后 `init` 才采集）。
- **TypeScript 优先** — 全量类型 + `UmengError` 错误码，随包附带官方 Jest mock。

> 首版只支持微信会话 + 钉钉，朋友圈 / QQ / 微博暂不支持。

## 安装

```sh
yarn add @unif/react-native-umeng \
  @unif/react-native-design \
  @gorhom/bottom-sheet \
  react-native-gesture-handler \
  react-native-svg
```

分享面板的 UI 基于 `@unif/react-native-design`，上述 peer 均必装；iOS 还需 `pod install`。微信 / 钉钉的 URL Scheme、AppDelegate、Android 回调 Activity、微信 Universal Link 等原生注册步骤较多，**完整步骤见[文档站 · 原生配置](https://unif-design.github.io/react-native-umeng/docs/native-setup/ios)**。

## 快速开始

根组件包裹 `<GestureHandlerRootView>` + `<ThemeProvider>`，并挂一次 `<ShareSheetHost />`：

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

// 1. App 启动预初始化（隐私协议前，不上报）；所有 config 都在这里给
await Common.preInit({ appkey: 'YOUR_APPKEY', wechatAppId: 'wx…', dingtalkAppId: 'dingoa…' });
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
- AI 编码助手用 [`using-unif-umeng`](https://github.com/unif-design/react-native-skills) skill（含验证过的 API / 坑 / 原生 setup）。

## 兼容性

仅支持 **RN 0.85 新架构**（New Architecture / TurboModule）、React 19。iOS + Android（不支持 Web）。

## License

MIT
