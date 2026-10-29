---
title: 分享组合
description: 准备内容、选择目标并接收同一次分享结果。
---

# 分享组合

先准备 `ShareContent`：文字直接提供；图片或长图由应用完成截图和上传，得到 HTTP(S) 地址后交付库。

```ts
const content = {
  type: 'image',
  imageUrl: 'https://example.com/receipt.png',
} as const;
const result = await controller.open(content, {
  presentation: 'floating',
  title: '分享图片',
  onLayout: (height) => reserveSpace(height),
  onDismiss: () => releasePresentation(),
  signal: abortController.signal,
});
```

此例的 controller 与 host 来自同一个 `useShareSheet()`，并把 host 渲染在图片预览实际窗口。`reserveSpace` 与 `releasePresentation` 为应用自己的呈现处理；它们不提交业务结果，也不删除仍由原分享使用的文件。

普通直接分享用 `share({ target, content })`。两条入口使用同一个分享操作与原生通道。SDK 在途时，新分享返回 `busy`。面板选择取消不带默认目标，SDK 取消可带本次目标。

调用返回 `success` 仅表示有效 SDK 成功回执，不能作为接收方已阅读、订单已提交或文件已保存的证明。关闭面板、App 拉起、`onDismiss` 和 Promise 开始等待都不是成功证据。

iOS 分享发起后实际进入后台再回到前台，或 Android 原宿主 Activity 停止（排除配置重建）后恢复，仍没有回执时，该次调用以 `failed / invalid_response` 结束。原请求标识随之失效，下一次仍可通过原入口正常分享；该结果不证明发送未发生，也不表示用户取消。仅 iOS `inactive`、Android `onHostPause` 或尚未发给厂商的请求不因此结束，已有真实回执保持原结果。

本库按原请求标识忽略已经结束请求的迟到 completion；新请求继续接收自己的成功、取消和失败，包括未离开应用的异步失败。该保护不代表厂商未提供标识的原始回包具备完整请求关联，实际目标应用往返仍需设备验证。

调用方切换页面、客户或图片不替换原内容快照。SDK 开始后取消 signal 或卸载宿主只结束呈现，原调用仍接收真实结果；业务是否采用结果由原场景决定。

[分享 API](../api/share) · [实例面板 API](../api/platform-sharesheethost)
