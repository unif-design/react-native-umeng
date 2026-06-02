---
sidebar_position: 8
title: 常见问题
description: 错误码表、iOS 回调不触发、Android WXEntry/DDShare 未注册等常见问题排查。
---

# 常见问题

## 错误码

| `code` | 含义 | 触发场景 | 处理建议 |
| --- | --- | --- | --- |
| `E_PLATFORM_NOT_INSTALLED` | 微信 / 钉钉未安装 | 调 `shareLink` / `openSheet` 时目标 App 未安装 | `isInstalled()` 预检，或 `hideUninstalled: true` 隐藏未安装项 |
| `E_PLATFORM_NOT_SUPPORTED` | platform 字串不在白名单 | 传了未定义的 `platform` 字符串 | 确认使用 `Platform` 枚举值 |
| `E_INVALID_OPTIONS` | 参数缺失 / 类型错 | `shareLink` 缺 `title` 或 `url`，`preInit` 缺 `appkey` 等 | 检查必填字段 |
| `E_USER_CANCEL` | 用户取消 | 用户点了取消按钮或 scrim | 通常忽略，无需提示 |
| `E_SHARE_FAILED` | 友盟回调失败 | 未配 URL Scheme、网络错、分享内容不合规等 | 查 `message` 字段；检查 URL Scheme / Universal Link 配置 |
| `E_NOT_INITIALIZED` | 预留错误码 | — | — |
| `E_UNKNOWN` | 其他未知错误 | 友盟 SDK 返回了无法归类的错误 | 查 `nativeError` 字段获取原始错误 |

---

## iOS

### ❓ 分享后回调不回来 / 结果丢失

✅ **检查 `CFBundleURLTypes` 是否配置正确。**

微信分享后跳回 App 依赖 URL Scheme 回调。确认 `Info.plist` 中 `CFBundleURLTypes` 包含微信和钉钉的 URL Scheme：

- 微信：`wx` + appid（如 `wxXXXXXXXX`）
- 钉钉：`dingoa` + appid（如 `dingoaXXXXXXXX`）

详见 [iOS 原生配置](./native-setup/ios)。

---

### ❓ 模拟器上微信 / 钉钉分享编译失败或无法跑起来

✅ **用真机测试，不要用模拟器。**

友盟 UMShare 6.11.1 在 Apple Silicon Mac 模拟器上有 `EXCLUDED_ARCHS=arm64` 限制（旧式 .framework 没出 arm64 simulator slice）。这是友盟 SDK 已知限制，**强制清 `EXCLUDED_ARCHS` 反而可能触发 arm64 链接错**。用真机验证分享功能即可。

---

### ❓ AppDelegate 编译报 `has been renamed to 'handleOpen(_:options:)'`

✅ **方法名写错了，应为 `handleOpen(_:options:)`，不是 `handleOpenURL`。**

Swift omit-needless-words 规则：ObjC `handleOpenURL:options:` 导入 Swift 后是 `handleOpen(_:options:)`。详见 [iOS 原生配置 → AppDelegate](./native-setup/ios)。

---

## Android

### ❓ 分享后无回调 / `E_SHARE_FAILED`

✅ **检查 `WXEntryActivity` 和 `DDShareActivity` 是否已注册且包名正确。**

微信 / 钉钉 SDK 通过 `getPackageName() + ".wxapi.WXEntryActivity"` 反射找回调 Activity。若包名不匹配或 Activity 未注册到 `AndroidManifest.xml`，回调会丢失。

核查清单：
1. `android/app/src/main/AndroidManifest.xml` 中两个 Activity 是否声明（见 [Android 原生配置](./native-setup/android)）
2. `WXEntryActivity.kt` 包名是否与 App 包名一致（如 `com.example.app.wxapi`）
3. `DDShareActivity.kt` 包名是否与 App 包名一致（如 `com.example.app.ddshare`）

---

### ❓ 后台调 `Share.openSheet()` 时报 `E_UNKNOWN`（message 含 "No current Activity"）

✅ **分享 API 依赖前台 Activity，不可在后台或 App 不可见时调用。**

Android 在无前台 Activity 时会 reject `E_UNKNOWN`，`message` 为 `No current Activity; cannot invoke share` —— 用 `message` 字段区分此场景与其它 `E_UNKNOWN`。确保在用户有操作行为的前台场景（如点击按钮回调）中调用分享 API。
