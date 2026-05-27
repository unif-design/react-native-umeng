# Security Policy

## 报告漏洞

如果你发现 `@unif/react-native-umeng` 中的安全漏洞，**请不要在公开 Issue 里描述细节**，避免在补丁发布前被利用。

请通过 GitHub 的 **Private vulnerability reporting** 提交：

👉 https://github.com/unif-design/react-native-umeng/security/advisories/new

我们会在 **3 个工作日内**回复，确认漏洞后通常 **2 周内**发布 patch 版本 + GitHub Security Advisory。

## 范围

| 在范围 | 不在范围 |
|---|---|
| Native module 桥代码（iOS Swift/ObjC++、Android Kotlin） | 友盟 SDK 本身的漏洞（请直接报给 [友盟](https://developer.umeng.com/)）|
| JS / TypeScript 层逻辑（`src/`） | 微信 / 钉钉官方 SDK 漏洞（请报给腾讯 / 阿里）|
| TurboModule spec / codegen 配置 | example 工程的演示代码 |
| README / 文档站建议的宿主集成步骤 | 第三方 npm 依赖（请到对应仓库报）|

## 已支持的版本

| 版本 | 支持情况 |
|---|---|
| `0.x` (latest) | ✅ 接受安全报告 + 提供 patch |
| `< 0.1.0` | ❌ 早期开发版,请升级 |

## 致谢

负责任报告（responsible disclosure）的研究者将在 Security Advisory 致谢列表中显式提及（除非要求匿名）。
