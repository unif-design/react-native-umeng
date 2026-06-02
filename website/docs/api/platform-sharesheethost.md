---
sidebar_position: 4
title: Platform & ShareSheetHost
description: Platform 枚举、ShareSheetHost 根组件挂载说明。
---

# Platform & ShareSheetHost

## 引用

```ts
import { Platform, ShareSheetHost } from '@unif/react-native-umeng';
```

---

## `Platform` 枚举

本桥首版支持的分享目标平台：

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

---

## `<ShareSheetHost />`

分享面板的 Portal 宿主组件，**必须挂在应用根组件**，位于 `GestureHandlerRootView` 和 `ThemeProvider` 内部。无任何 props。

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

`Share.openSheet()` 依赖此宿主。未挂载时 Promise 立即 reject。

---

## 平台支持

| | iOS | Android |
| --- | --- | --- |
| `Platform` 枚举 | ✅ | ✅ |
| `ShareSheetHost` | ✅ | ✅ |

## 相关

- [Share API](./share) — `openSheet` / `shareLink` 用法
- [分享指南](../guides/sharing)
- [快速上手](../getting-started/quick-start)
