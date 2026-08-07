# @unif/react-native-umeng

[![npm](https://img.shields.io/npm/v/@unif/react-native-umeng.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/@unif/react-native-umeng)
[![CI](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml/badge.svg)](https://github.com/unif-design/react-native-umeng/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@unif/react-native-umeng.svg?color=blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-unif--design.github.io-orange.svg)](https://unif-design.github.io/react-native-umeng/)

友盟 React Native 新架构桥：**U-Share**（微信会话 / 钉钉分享）+ **U-App** 移动统计。

当前仓库开发 / example 验证基线为 **React Native 0.86.2**、**React 19.2.3**、**@unif/react-native-design 0.24.0**。peer 接受 `>=0.21.0 <1.0.0` —— 下限来自 0.21 收紧后的 `Cell.leading` 与 `TextFieldSlot` 契约,0.20 编译不过。

> iOS 的初始化状态机、Share/Analytics 门禁、TurboModule 注册、AppDelegate/SceneDelegate 转发和 example 配置已通过 native contract、simulator build 与 XCTest。Android CI 已通过 native contract、bootstrap/callback JVM tests、启用 minify 的 release 构建与 merged manifest 核对。真实微信 / 钉钉拉起与回包、iOS URL Scheme / Universal Link / AASA、Android 真机 R8 运行仍须在对应环境验证。

## 特性

- **U-Share** — 微信会话 + 钉钉，支持文本 / 图片 / 链接。
- **命令式分享面板** — 根上挂一次 `<ShareSheetHost />`，调用 `Share.openSheet()` 即可拉起 RN `Modal` 面板。
- **U-App 统计** — 同步的 `Analytics.onEvent` / `signIn` / `signOut`。
- **PIPL 合规** — `Common.preInit(config)` 只保存 JS 快照；用户同意后，无参 `Common.init()` 才进入 native/vendor 初始化。
- **稳定错误契约** — 分享只在成功时 resolve；取消、失败和未安装平台均 reject `UmengError`。
- **官方 Jest mock** — 随包导出 `@unif/react-native-umeng/mock`。

> 首版不支持朋友圈、QQ 或微博。

## 安装

RN 工程提供 `react` / `react-native`，其余 peerDependencies 使用 Yarn 一次装齐：

```sh
yarn add @unif/react-native-umeng \
  '@sbaiahmed1/react-native-blur@>=4' \
  '@unif/react-native-design@>=0.21.0 <1.0.0' \
  'react-native-gesture-handler@>=3.0.0 <4.0.0' \
  'react-native-reanimated@^4.5.3' \
  'react-native-reanimated-carousel@>=5.0.0 <6.0.0' \
  'react-native-safe-area-context@>=5' \
  'react-native-svg@>=15' \
  'react-native-worklets@^0.11.3'
```

React Native Community CLI 项目的 `babel.config.js` 还必须把 Worklets plugin 放在 `plugins` 最后：

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // 其它 plugin
    'react-native-worklets/plugin',
  ],
};
```

当前 `@unif/react-native-design` 组合使用 RNGH 3 与 Carousel 5。Carousel 5 发布 metadata 的 RNGH peer 仍停在 `<3`，仓库通过 scoped override、窄 allowlist 与漂移检查管理这条已验证例外；不要为消除该 warning 降级 RNGH，也不要使用 `--force` 或 `--legacy-peer-deps`。

完整依赖范围见[安装文档](https://unif-design.github.io/react-native-umeng/docs/getting-started/installation)。

## 快速开始

`<ShareSheetHost />` 必须在 App 根挂一次，并位于 design 的 `<ThemeProvider>` 内。Host 已在自己的 `Modal` 内容里创建 `GestureHandlerRootView`；App 外层 root 只按其他 UI 的需要保留，不是 Host 生效的硬前提。

```tsx
import { ThemeProvider } from '@unif/react-native-design';
import {
  Common,
  Share,
  ShareSheetHost,
  UmengError,
} from '@unif/react-native-umeng';

export function App() {
  return (
    <ThemeProvider>
      <Screen />
      <ShareSheetHost />
    </ThemeProvider>
  );
}

// 1. App 启动、用户授权前：只在 JS 校验、标准化并冻结配置快照
await Common.preInit({
  appkey: 'YOUR_UMENG_APPKEY',
  wechatAppId: 'YOUR_WECHAT_APP_ID',
  wechatAppSecret: 'YOUR_WECHAT_APP_SECRET',
  wechatUniversalLink: 'https://your.host/path/',
  dingtalkAppId: 'YOUR_DINGTALK_APP_ID',
});

// 2. 用户明确同意《隐私协议》后：无参 init 才跨入 native/vendor
await Common.init();

// 3. 只有成功才 resolve；取消 / 失败都在 catch 中处理
try {
  const result = await Share.openSheet({
    type: 'link',
    title: '标题',
    url: 'https://example.com',
  });
  // result.code === 'success'
} catch (error) {
  if (error instanceof UmengError && error.code === 'E_USER_CANCEL') {
    // 用户取消，通常静默
  }
}
```

iOS 启用微信时 `wechatAppId`、`wechatAppSecret`、绝对 HTTPS `wechatUniversalLink` 三项必须同时提供；Android 启用微信时前两项必须成组，Universal Link 可省略。初始化开始后更换 config 会 reject `E_INVALID_OPTIONS`；没先 `preInit` 直接 `init` 会 reject `E_NOT_INITIALIZED`。

## 文档

- 文档站：<https://unif-design.github.io/react-native-umeng/>
- AI 索引：<https://unif-design.github.io/react-native-umeng/llms.txt> · 全文：<https://unif-design.github.io/react-native-umeng/llms-full.txt>
- AI 编码助手：[`umeng-share`](https://github.com/unif-design/skills/tree/main/skills/umeng-share) Skill
- [Example 展厅](./example/README.md)：运行时填写凭据，逐步验证隐私同意、平台检测、分享、统计与原生回调。

## 平台与验证边界

| 平台 | 当前证据 | 仍需验证 |
| --- | --- | --- |
| iOS | native contract、simulator build、31/31 XCTest、三个 TurboModule provider | 真机微信 / 钉钉分享、URL Scheme、Universal Link/AASA |
| Android | native contract、JVM tests、minified release build、merged manifest | 真机微信 / 钉钉回跳、真机 R8 运行 |
| Web / 模拟器 | JS、文档站和 native 单测可运行 | 不能代替第三方 App 真分享 |

## License

MIT
