---
title: 统计接入
description: 由应用安排统计时机和账号关联。
---

# 统计接入

应用取得真实授权并完成 `initializeUmeng(config)` 后，在对应业务动作中调用 `trackEvent({ name, attributes })`。三个统计 API 都是同步 `void`，无需 await，也不以返回代表云端接收。

真实登录成功后调用 `bindAnalyticsUser({ userId, provider })`，业务退出后调用 `clearAnalyticsUser()`。库不读取账号、不判断登录成功，不持久化第二份登录事实。

属性只接受字符串或有限数字。保留事件名与原始属性语义；数字到原生字符串的转换由库处理。SDK 未就绪的调用不会触达厂商或排队补发。

[统计 API](../api/analytics) · [隐私时机](./privacy-pipl)
