---
title: 初始化
description: 一次交付配置，查询原生 SDK 实际就绪状态。
---

# 初始化

## initializeUmeng(config) {#init}

应用取得真实隐私同意后调用，返回 `Promise<void>`，表示本地 SDK 初始化步骤结束。库不保存业务同意记录，不自动初始化或重试。

```ts
import { initializeUmeng, isUmengInitialized } from '@unif/react-native-umeng';

await initializeUmeng({
  appKey: 'YOUR_UMENG_APPKEY',
  channel: 'release',
  wechat: {
    appId: 'YOUR_WECHAT_APP_ID',
    appSecret: 'YOUR_WECHAT_APP_SECRET',
    universalLink: 'https://your.host/wechat/',
  },
  dingtalk: { appId: 'YOUR_DINGTALK_APP_ID' },
});
const ready = await isUmengInitialized();
```

### UmengConfiguration {#umengconfiguration}

| 字段 | 类型 | 要求 |
| --- | --- | --- |
| appKey | string | 必填非空 |
| channel | string | 可选；缺省使用原生默认渠道 |
| wechat | WeChatConfiguration | 不传时不注册微信 |
| dingtalk | DingTalkConfiguration | 不传时不注册钉钉 |
| wechat.appId / appSecret | string | 微信配置内两项均必填 |
| wechat.universalLink | string | 带 host 的绝对 HTTPS URL；iOS 配置微信时必填 |
| dingtalk.appId | string | 钉钉配置内必填 |

字段一旦提供必须合法。凭据使用开放平台分配的真实原值，不手动拼前缀。配置取不可变快照；相同配置的并发调用共享同一 Promise，成功后重复调用不启动 SDK。初始化开始后换配置得到 `configuration_locked`，失败后也不能更换；后续明确调用可使用同一配置再尝试。原生厂商异常导致副作用无法判断时，需要重启进程。

## isUmengInitialized() {#isinited}

直接读取原生实际就绪状态，返回 `Promise<boolean>`；失败抛 `UmengError`，无效回执为 `invalid_response`，不以 `false` 掩盖查询失败。JS 不维护第二份就绪状态。

初始化失败以 `UmengError.reason` 区分 `invalid_input`、`configuration_locked`、`sdk_failed`、`unavailable`；Web 为 `unsupported`。可选 `sourceCode` 保留原生错误码，不暴露原始原生对象。

[原生接入](../native-setup/ios) · [隐私时机](../guides/privacy-pipl)
