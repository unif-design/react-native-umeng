---
title: 常见问题
description: 按明确失败原因核对初始化、宿主与真实原生回调。
---

# 常见问题

## 未初始化或目标没有出现 {#not-initialized}

取得授权后传入完整 `initializeUmeng(config)`；`getShareTargets()` 只列出配置的目标。没有分享平台的统计应用可以得到空数组。直接分享未配置目标返回 `not_initialized`。

## 配置被锁定 {#configuration-locked}

初始化一旦开始，配置不可更换。保持同一配置明确重试；如需更换凭据，重启应用进程。原生 SDK 异常导致副作用无法判断时也需重启。

## 面板 unavailable 或 busy {#sheet-host}

渲染同一个 `useShareSheet()` 返回的 host；将 host 放在实际呈现窗口。当前实例或原生分享通道未结束时返回 `busy`，不要自动重试。

## 分享无回调 {#native-callback}

检查 [iOS URL Scheme、Universal Link 与宿主转发](./native-setup/ios) 和 [Android 回调 Activity](./native-setup/android)。只拉起目标 App 不能证明成功。使用真实设备和真实平台分配配置验证往返；不补造成功回执。

## 取消与关闭 {#cancel}

选择前关闭或取消返回 `cancelled`。SDK 开始后，signal 或宿主卸载只结束呈现；原调用继续等待真实回执。`onDismiss` 只表示显示结束。

## Web 与单测 {#web}

Web 功能明确 `unsupported`，不会把无法查询伪装为未安装。Jest 使用[官方 mock](./testing)。原生模块缺失时检查依赖安装、Codegen 和构建，结果为 `unavailable`。
