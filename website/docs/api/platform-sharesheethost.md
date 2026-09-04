---
sidebar_position: 4
title: Platform & ShareSheetHost
description: 'Platform & ShareSheetHost 参考：Platform 是分享目标枚举（wechat_session / dingtalk）；ShareSheetHost 支持 modal 与无遮罩 floating 呈现，须挂在 ThemeProvider 内。'
---

# Platform & ShareSheetHost

分享目标枚举与命令式面板的宿主组件。

## 引用 {#import}

```ts
import {
  Platform,
  ShareSheetHost,
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DEFAULT_SUBTITLES,
  PLATFORM_BRAND_COLORS,
} from '@unif/react-native-umeng';
```

---

## `Platform` 枚举 {#platform-enum}

本桥首版支持的**分享目标平台**：

```ts
enum Platform {
  WECHAT_SESSION = 'wechat_session',
  DINGTALK = 'dingtalk',
}
```

| 枚举值                    | 字符串值           | 说明                |
| ------------------------- | ------------------ | ------------------- |
| `Platform.WECHAT_SESSION` | `'wechat_session'` | 微信好友会话 / 群聊 |
| `Platform.DINGTALK`       | `'dingtalk'`       | 钉钉工作群 / 好友   |

:::danger 不是 react-native 的 Platform
umeng 的 `Platform` 是**分享目标枚举**，**没有 `.OS`**。判断操作系统请用 `react-native` 的 `Platform`；同时用到两者时起别名：

```ts
import { Platform } from 'react-native'; // OS 判断
import { Platform as ShareTarget } from '@unif/react-native-umeng'; // 分享目标
```

:::

### 相关常量 {#platform-constants}

| 常量                         | 类型                       | 说明                                                                   |
| ---------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `SUPPORTED_PLATFORMS`        | `ReadonlyArray<Platform>`  | 支持的平台列表（也是面板默认渲染顺序）：`[WECHAT_SESSION, DINGTALK]`   |
| `PLATFORM_DISPLAY_NAMES`     | `Record<Platform, string>` | 显示名：微信 / 钉钉                                                    |
| `PLATFORM_DEFAULT_SUBTITLES` | `Record<Platform, string>` | 面板默认副标题：`'发送给好友或群'` / `'发送至工作群'`                  |
| `PLATFORM_BRAND_COLORS`      | `Record<Platform, string>` | 品牌色：`#07C160`（微信）/ `#2595E8`（钉钉），用作面板平台前导小块实色 |

---

## `<ShareSheetHost />` {#share-sheet-host}

分享面板的宿主组件，**无任何 props**。订阅模块级 `shareSheetController`，在 `Share.openSheet()` 触发时渲染 design `Cell` / `Button` 面板；默认承载于 RN `Modal`，`floating` 时直接作为当前布局内的绝对定位浮层。

```ts
const ShareSheetHost: React.FC; // 无 props
```

### 挂载 {#mount}

**至少挂载一个 Host**，且位于 design 的 `ThemeProvider` 内。默认 `modal` 可在 App 根挂载；页面需要 `floating` 时可就近再挂一个，最新挂载的 Host 会承载新 session。App 若有其它 RNGH UI,仍可保留外层 `GestureHandlerRootView`：

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

:::warning openSheet 依赖此宿主
未挂载时 `Share.openSheet()` 立即 reject（`E_UNKNOWN`，message `No <ShareSheetHost /> mounted`）；**一次只能有一个 active session**，重入会 reject。平台查询失败会在 loading 阶段直接 reject,不会显示假数据;本次 owner Host 卸载也会 reject `E_UNKNOWN`。挂载细节见[快速上手](../getting-started/quick-start#mount-host)。
:::

controller 用 `sessionId + owner Host + phase` 隔离生命周期。最新注册的 Host 承载本次 session；非 owner 卸载不影响它。`floating` 在 sharing 期间保持可操作，取消后旧 session 的迟到/重复回调也不能结算新 session。

:::info Modal 内部的 Gesture Handler 边界
RN `Modal` 在 Android 创建独立 native root。`ShareSheetHost` 已在 Modal 内容内包 `GestureHandlerRootView`;App 外层 root 不能跨过 Modal 边界,也不能替代内部这一层。消费者只负责正常挂 Host,不要复制或移除库内边界。
:::

> 测试时官方 mock 的 `ShareSheetHost` 渲染 `null`（不引 design），见[测试](../testing)。

---

## 平台支持 {#platform-support}

|                        | iOS                                | Android                            |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| `Platform` 枚举 / 常量 | ✅                                 | ✅                                 |
| `<ShareSheetHost />`   | ✅ UI/controller；端到端分享待真机 | ✅ UI/controller；端到端分享待真机 |

## 相关 {#related}

- [Share API](./share#opensheet) —— `openSheet` / `shareXxx` 用法与参数
- [分享指南](../guides/sharing) —— 任务导向用法与坑
- [快速上手](../getting-started/quick-start#mount-host) —— 宿主挂载位置
