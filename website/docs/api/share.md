---
title: 分享
description: 查询已配置平台，并交付 SDK 分享的成功、取消或失败结果。
---

# 分享

## getShareTargets() {#getsharetargets}

返回 `Promise<readonly ShareTargetInfo[]>`。每项含 `target`、中文 `label` 和实际 `installed` 状态。目标只有 `wechat_session` 与 `dingtalk`；顺序由原生配置交付。没有配置分享平台的统计应用返回空数组。未初始化、查询失败或缺少宿主不会伪装成“未安装”。

```ts
import { getShareTargets, share } from '@unif/react-native-umeng';
const targets = await getShareTargets();
const result = await share({
  target: 'wechat_session',
  content: { type: 'text', text: '你好' },
});
if (result.status === 'failed') {
  console.log(result.error.reason);
}
```

## share(input) {#share}

`ShareRequest` 含明确的 `target: ShareTarget` 与 `content: ShareContent`。返回 `Promise<ShareResult>`，参数无效也交付 `failed`，不要求调用方用异常区分取消。

| 内容 | 必填字段 | 可选字段 |
| --- | --- | --- |
| text | type: 'text'、text | — |
| image | type: 'image'、imageUrl | thumbnailUrl |
| link | type: 'link'、title、url | description、thumbnailUrl |

文字和标题须非空。图片、链接、缩略图为带 host 的绝对 HTTP(S) 地址。文本、标题和说明保留原意，空字符串说明可以明确传入。库取本次输入快照；截图、上传、长图生成由消费者提前完成，厂商 SDK 自身的图片读取无需应用重复下载或上传。

## ShareResult {#shareresult}

```ts
type ShareResult =
  | { status: 'success'; target: ShareTarget }
  | { status: 'cancelled'; target?: ShareTarget }
  | { status: 'failed'; target?: ShareTarget; error: UmengFailure };
```

`success` 只表示收到本次目标对应的 SDK 成功回执。`cancelled` 来自选择前取消或厂商明确取消；未选择目标时没有 `target`。`failed` 表示明确错误或无法确认回执，不证明外部分享一定没发生。未知或目标不匹配的回执为 `invalid_response`。不因取消、失败或外部 App 拉起自动重试。

同一原生分享通道在途时，新分享返回 `busy`。未配置目标返回 `not_initialized`，已配置但未安装返回 `not_installed`。

## UmengFailure 与 UmengError {#errors}

`UmengFailure` 含 `reason`、`message`、可选 `sourceCode`。`UmengError` 以 `new UmengError(failure)` 构造；查询和初始化抛出它，分享结果中的 `error` 为普通对象。

| reason | 含义 |
| --- | --- |
| invalid_input | 输入不符合公开契约 |
| configuration_locked | 初始化开始后更换配置 |
| not_initialized | SDK 未就绪或目标尚未配置 |
| not_installed | 已配置目标的 App 未安装 |
| busy | 分享通道或本实例尚有未结束调用 |
| sdk_failed | SDK 或传输失败 |
| invalid_response | 无效或目标不对应的回执 |
| unavailable | 当前原生模块或呈现宿主不可用 |
| unsupported | 当前平台不支持 |

[实例分享面板](./platform-sharesheethost) · [初始化](./common)

自动化验证不能替代安装了微信／钉钉的真实 App 往返验证；需在设备确认平台回调、Universal Link 和 release 行为。
