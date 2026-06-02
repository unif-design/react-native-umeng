---
sidebar_position: 2
title: 快速上手
description: 从根组件挂载到第一次分享，最小可运行流程。
---

# 快速上手

## 最小可运行流程

### ① 根组件挂载 `ShareSheetHost`

`<ShareSheetHost />` 是分享面板的 Portal 宿主，**必须挂在应用根组件**，且位于 `GestureHandlerRootView` 和 `ThemeProvider` 内部：

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import { ShareSheetHost } from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <YourNavigationStack />
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

### ② App 启动后立刻预初始化

`Common.preInit()` 存 config 并注册微信/钉钉平台，**不上报数据**，可在用户同意《隐私协议》之前调用：

```ts
import { Common } from '@unif/react-native-umeng';

await Common.preInit({
  appkey: 'YOUR_UMENG_APPKEY',
  channel: 'App Store',
  wechatAppId: 'wxXXXXXXXX',
  wechatAppSecret: 'XXXXXXXX',
  wechatUniversalLink: 'https://your.host/',
  dingtalkAppId: 'dingoaXXXXXXXX',
});
```

### ③ 用户同意后正式启动采集

```ts
// 仅在用户点击同意《隐私协议》后调用
await Common.init();
```

### ④ 拉起分享面板

```ts
import { Share } from '@unif/react-native-umeng';

const r = await Share.openSheet({
  type: 'link',
  title: '问问看',
  url: 'https://example.com',
  description: '一句话描述',
});
// r = { code: 'success' | 'cancel' | 'failed', platform, message? }
```

:::warning preInit / init 顺序与 PIPL
`Common.init()` **必须在用户明确同意《隐私协议》之后**才能调用，不可提前。`preInit` 与 `init` 顺序不能颠倒，`init` 前必须先调过 `preInit`。详见[隐私合规指南](../guides/privacy-pipl)。
:::

## 下一步

- [分享指南](../guides/sharing) — 命令式面板 vs 直拉平台，选项详解
- [Common API](../api/common) — preInit / init / isInited 完整参数
