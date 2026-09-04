---
sidebar_position: 2
title: 快速上手
description: '5 分钟跑通 @unif/react-native-umeng：App 根挂 <ShareSheetHost />，启动时 Common.preInit(config)，用户同意后 Common.init()（无参），再 await Share.openSheet(payload) 拉起分享面板。'
---

# 快速上手

5 分钟跑通:根挂 `<ShareSheetHost />` → 启动时 `preInit` → 用户同意后 `init` → `await Share.openSheet()` 拉起面板。

:::info 当前验证边界
这套流程已在 JS、Android 和 iOS 落地。iOS 已通过 simulator build/XCTest/native contract；Android CI 已通过 native contract、JVM tests、启用 minify 的 release 构建与 merged manifest 核对。真实第三方 App 回跳与 Android 真机 R8 运行仍需真机验证。
:::

:::warning 分享必须真机运行
分享会调起原生微信 / 钉钉,**模拟器没有真 App,无法完成回调跳转**(属预期行为)。先完成[安装](./installation)(peerDeps + `pod install` + 原生回调配置)再运行本例。
:::

---

## ① 在 App 根挂 `<ShareSheetHost />` {#mount-host}

`<ShareSheetHost />` 是命令式分享面板的宿主，**至少挂载一个**且位于 design 的 `ThemeProvider` 内。默认 `modal` 推荐放 App 根；若页面使用 `floating` 并需要面板外触摸留在当前页面，可在页面内再挂一个 Host，最新挂载者会承载新 session。示例保留 App 外层 `GestureHandlerRootView` 供其余 RNGH UI 使用:

```tsx title="App.tsx（或根组件）"
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import { ShareSheetHost } from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <YourNavigationStack />
        <ShareSheetHost />
        {/* 根上挂一次,位置不影响显示(打开时全屏覆盖) */}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

不挂 Host,`Share.openSheet()` 会立即 reject(`No <ShareSheetHost /> mounted`)。在 `modal` 模式下，Host 会在 RN `Modal` 内容里创建另一层 `GestureHandlerRootView`;Modal 是独立 native root,App 外层 root 不能替代内部这一层。消费者无需手工再包 Modal 内容。

## ② App 启动后立刻 `preInit`(此时不上报) {#preinit}

`Common.preInit(config)` 只在 JS 侧校验、标准化并保存 config 快照,**不调用 native、不注册微信 / 钉钉平台、不上报任何数据**,因此可以(也应该)在用户同意《隐私协议》之前调。**所有配置都在这里给**:

```ts
import { Common } from '@unif/react-native-umeng';

await Common.preInit({
  appkey: 'YOUR_UMENG_APPKEY', // 必填
  channel: 'App Store', // 可选,默认 iOS='App Store' / Android='default'
  wechatAppId: 'YOUR_WECHAT_APP_ID', // 使用平台分配的原值
  wechatAppSecret: 'YOUR_WECHAT_APP_SECRET',
  wechatUniversalLink: 'https://your.host/', // 微信 1.8.6+(iOS)要求
  dingtalkAppId: 'YOUR_DINGTALK_APP_ID', // 使用平台分配的原值
});
```

iOS 启用微信时 `wechatAppId`、`wechatAppSecret`、绝对 HTTPS `wechatUniversalLink` 三项必须同时提供；Android 启用微信时前两项必须成组，Universal Link 可省略。任一可选字段一旦出现也必须是非空字符串。

## ③ 用户同意后,`init` 开始采集(无参) {#init}

```ts
// 仅在用户点「同意《隐私协议》」之后调用
await Common.init(); // ⚠️ 无参 —— config 已给 preInit
```

`Common.init()` **不接收 config**(配置已给 `preInit`)。没先 `preInit` 直接 `init` 会 reject `E_NOT_INITIALIZED`。用户同意后调用时,Android 才依次执行 vendor preInit、平台注册、FileProvider 与正式 init；iOS 才执行 Universal Link 配置、微信 / 钉钉注册与 `UMConfigure.initWithAppkey`。两段式合规细节见[隐私合规(PIPL)](../guides/privacy-pipl)。

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

需要让长图等下层内容继续滚动时，改用无遮罩浮层；`onSheetLayout` 可回传真实高度，`onDismiss` 在浮层完全移除（或打开前失败）时调用一次：

```ts
await Share.openSheet(
  { type: 'image', image: 'https://example.com/order.png' },
  {
    presentation: 'floating',
    onSheetLayout: (height) => setBottomInset(height),
    onDismiss: () => setSharing(false),
  }
);
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
Analytics.signIn('user-123', 'WX'); // provider 可选
Analytics.signOut();
```

---

## 下一步

- [指南 → 分享](../guides/sharing) —— 面板 vs 直拉、内容类型、取消失败处理
- [指南 → 统计埋点](../guides/analytics) —— `onEvent` / `signIn` / `signOut` 详解
- [指南 → 隐私合规(PIPL)](../guides/privacy-pipl) —— 两段式初始化时序
- [API 参考 → Common](../api/common) —— preInit / init / isInited 完整参数
