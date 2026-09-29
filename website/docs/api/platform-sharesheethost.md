---
title: 实例分享面板
description: useShareSheet 返回稳定控制器与本窗口需要渲染的宿主。
---

# 实例分享面板

## useShareSheet() {#use-share-sheet}

```tsx
import { Button, ThemeProvider } from '@unif/react-native-design';
import { useShareSheet } from '@unif/react-native-umeng';

function ShareAction() {
  const [controller, host] = useShareSheet();
  return <>
    <Button label="分享" onPress={async () => {
      const result = await controller.open({ type: 'text', text: '你好' });
      if (result.status === 'failed') console.log(result.error.reason);
    }} />
    {host}
  </>;
}
export function Screen() {
  return <ThemeProvider><ShareAction /></ThemeProvider>;
}
```

返回 `readonly [ShareSheetController, ReactElement]`。控制器身份稳定，宿主必须由本实例渲染。普通页面与图片预览模态各自创建实例，将宿主放在实际呈现窗口；没有全局宿主选择、注册或接管机制。缺宿主返回 `unavailable`，同实例存在未结束调用返回 `busy`。

面板先查询 `getShareTargets()`，再把选中的目标和原内容快照交给同一个 `share()`。

## controller.open(content, options?) {#open}

返回与 `share` 相同的 `Promise<ShareResult>`。`ShareSheetCallOptions` 在下表显示选项外接受 `signal?: AbortSignal`。

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| title | 分享至 | 标题 |
| cancelText | 取消 | 取消按钮文案 |
| hideUninstalled | false | 隐藏未安装目标 |
| subtitles | 内置中文副标题 | 按 ShareTarget 覆盖副标题 |
| presentation | modal | modal 或 floating |
| onLayout(height) | — | 实际面板高度 |
| onDismiss() | — | 本次显示结束，不代表分享取消 |
| signal | — | 结束本次选择或呈现 |

`floating` 使用无遮罩、面板外触摸穿透的布局，适合图片预览窗口。默认 modal 的实际原生窗口内有手势根；floating 由所在窗口提供手势根。主题来自宿主所在的 Design `ThemeProvider`。

未安装但仍显示的目标被选择后返回 `not_installed`，不会打开商店或自动改选其他目标。取消按钮、signal 或宿主卸载在开始分享前返回 `cancelled`。分享开始后结束呈现仍由原调用等待真实 SDK 回执；卸载或 `onDismiss` 不把结果改成取消。旧查询、布局和回调不得更新新面板。

[分享结果](./share#shareresult) · [分享组合](../guides/sharing)
