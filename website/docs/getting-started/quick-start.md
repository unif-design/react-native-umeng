---
sidebar_position: 2
title: 快速上手
description: "5 分钟跑通 @unif/react-native-umeng：App 根挂 <ShareSheetHost />，启动时 Common.preInit(config)，用户同意后 Common.init()（无参），再 await Share.openSheet(payload) 拉起分享面板。"
---

# 快速上手

5 分钟跑通:根挂 `<ShareSheetHost />` → 启动时 `preInit` → 用户同意后 `init` → `await Share.openSheet()` 拉起面板。

:::warning 分享必须真机运行
分享会调起原生微信 / 钉钉,**模拟器没有真 App,无法完成回调跳转**(属预期行为)。先完成[安装](./installation)(peerDeps + `pod install` + 原生回调配置)再运行本例。
:::

---

## ① 在 App 根挂 `<ShareSheetHost />` {#mount-host}

`<ShareSheetHost />` 是命令式分享面板的宿主,**必须在 App 根挂一次**,且位于 `GestureHandlerRootView` 和 design 的 `ThemeProvider` 内:

```tsx title="App.tsx（或根组件）"
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import { ShareSheetHost } from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <YourNavigationStack />
        <ShareSheetHost />{/* 根上挂一次,位置不影响显示(打开时全屏覆盖) */}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

不挂 Host,`Share.openSheet()` 会立即 reject(`No <ShareSheetHost /> mounted`)。已用 design 系统其他组件而挂过 `ThemeProvider` 的,沿用即可。

## ② App 启动后立刻 `preInit`(此时不上报) {#preinit}

`Common.preInit(config)` 只存配置、注册微信 / 钉钉平台,**不上报任何数据**,因此可以(也应该)在用户同意《隐私协议》之前调。**所有配置都在这里给**:

```ts
import { Common } from '@unif/react-native-umeng';

await Common.preInit({
  appkey: 'YOUR_UMENG_APPKEY',          // 必填
  channel: 'App Store',                  // 可选,默认 iOS='App Store' / Android='default'
  wechatAppId: 'wxXXXXXXXX',             // 不传则不注册微信分享
  wechatAppSecret: 'XXXXXXXX',           // 有 wechatAppId 才生效
  wechatUniversalLink: 'https://your.host/', // 微信 1.8.6+(iOS)要求
  dingtalkAppId: 'dingoaXXXXXXXX',       // 不传则不注册钉钉分享
});
```

## ③ 用户同意后,`init` 开始采集(无参) {#init}

```ts
// 仅在用户点「同意《隐私协议》」之后调用
await Common.init();   // ⚠️ 无参 —— config 已给 preInit
```

`Common.init()` **不接收 config**(配置已给 `preInit`)。没先 `preInit` 直接 `init` 会 reject。两段式合规细节见[隐私合规(PIPL)](../guides/privacy-pipl)。

## ④ 拉起分享面板 {#open-sheet}

```tsx
import { Share, UmengError } from '@unif/react-native-umeng';

async function onShareTap() {
  try {
    const r = await Share.openSheet({
      type: 'link',
      title: '问问看',
      url: 'https://example.com',
      description: '一句话描述',
    });
    // 走到这里说明分享成功:r.code 恒为 'success'
    console.log(r.platform); // 'wechat_session' | 'dingtalk'
  } catch (e) {
    if (e instanceof UmengError && e.code === 'E_USER_CANCEL') {
      // 用户取消,通常静默
    }
    // 其它如 E_SHARE_FAILED / E_PLATFORM_NOT_INSTALLED:兜底提示
  }
}
```

:::danger 取消 / 失败走 reject,不走 resolve
`Share.openSheet()` **只有成功才 resolve**(`r.code` 恒为 `'success'`);用户取消、分享失败都会**抛 `UmengError`**。务必 try/catch,**不要写 `if (r.code === 'cancel')`**(永远到不了)。详见[分享指南](../guides/sharing)。
:::

---

## 统计埋点(可选)

初始化完成后即可埋点。`Analytics.*` 都是**同步 `void`,不要 await**:

```ts
import { Analytics } from '@unif/react-native-umeng';

Analytics.onEvent('share_click', { source: 'detail', count: 1 }); // 数字自动转字符串
Analytics.signIn('user-123', 'WX');  // provider 可选
Analytics.signOut();
```

---

## 下一步

- [指南 → 分享](../guides/sharing) —— 面板 vs 直拉、内容类型、取消失败处理
- [指南 → 统计埋点](../guides/analytics) —— `onEvent` / `signIn` / `signOut` 详解
- [指南 → 隐私合规(PIPL)](../guides/privacy-pipl) —— 两段式初始化时序
- [API 参考 → Common](../api/common) —— preInit / init / isInited 完整参数
