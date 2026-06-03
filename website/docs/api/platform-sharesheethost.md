---
sidebar_position: 4
title: Platform & ShareSheetHost
description: "Platform & ShareSheetHost 参考：Platform 是分享目标枚举（wechat_session / dingtalk），不是 react-native 的 Platform、没有 .OS；附 PLATFORM_DISPLAY_NAMES / PLATFORM_DEFAULT_SUBTITLES / PLATFORM_BRAND_COLORS / SUPPORTED_PLATFORMS 常量。<ShareSheetHost /> 是分享面板宿主组件、无 props、须挂在 App 根（GestureHandlerRootView + ThemeProvider 内），openSheet 依赖它。"
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

| 枚举值 | 字符串值 | 说明 |
| --- | --- | --- |
| `Platform.WECHAT_SESSION` | `'wechat_session'` | 微信好友会话 / 群聊 |
| `Platform.DINGTALK` | `'dingtalk'` | 钉钉工作群 / 好友 |

:::danger 不是 react-native 的 Platform
umeng 的 `Platform` 是**分享目标枚举**，**没有 `.OS`**。判断操作系统请用 `react-native` 的 `Platform`；同时用到两者时起别名：

```ts
import { Platform } from 'react-native';                           // OS 判断
import { Platform as ShareTarget } from '@unif/react-native-umeng'; // 分享目标
```
:::

### 相关常量 {#platform-constants}

| 常量 | 类型 | 说明 |
| --- | --- | --- |
| `SUPPORTED_PLATFORMS` | `ReadonlyArray<Platform>` | 支持的平台列表（也是面板默认渲染顺序）：`[WECHAT_SESSION, DINGTALK]` |
| `PLATFORM_DISPLAY_NAMES` | `Record<Platform, string>` | 显示名：微信 / 钉钉 |
| `PLATFORM_DEFAULT_SUBTITLES` | `Record<Platform, string>` | 面板默认副标题：`'发送给好友或群'` / `'发送至工作群'` |
| `PLATFORM_BRAND_COLORS` | `Record<Platform, string>` | 品牌色：`#07C160`（微信）/ `#2595E8`（钉钉），用作面板平台前导小块实色 |

---

## `<ShareSheetHost />` {#share-sheet-host}

分享面板的宿主组件，**无任何 props**。订阅模块级 `shareSheetController`，在 `Share.openSheet()` 触发时渲染 design 的 `BottomSheet` + `Cell` 面板。

```ts
const ShareSheetHost: React.FC; // 无 props
```

### 挂载 {#mount}

**必须在 App 根挂载一次**，且位于 `GestureHandlerRootView` 和 design 的 `ThemeProvider` 内部（面板用 `useTheme` / `BottomSheet`）：

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
未挂载时 `Share.openSheet()` 立即 reject（`E_UNKNOWN`，message `No <ShareSheetHost /> mounted`）；**一次只能开一个面板**，重入会 reject。挂载细节见[快速上手](../getting-started/quick-start#mount-host)。
:::

> 测试时官方 mock 的 `ShareSheetHost` 渲染 `null`（不引 design），见[测试](../testing)。

---

## 平台支持 {#platform-support}

| | iOS | Android |
| --- | --- | --- |
| `Platform` 枚举 / 常量 | ✅ | ✅ |
| `<ShareSheetHost />` | ✅ | ✅ |

## 相关 {#related}

- [Share API](./share#opensheet) —— `openSheet` / `shareXxx` 用法与参数
- [分享指南](../guides/sharing) —— 任务导向用法与坑
- [快速上手](../getting-started/quick-start#mount-host) —— 宿主挂载位置
