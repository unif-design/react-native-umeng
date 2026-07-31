---
title: AI Skill
description: "umeng-share 是 @unif/react-native-umeng 的 Agent Skill,路由真实 API、原生配置、依赖与常见排障。"
---

# AI Skill：umeng-share

## 这是什么

`umeng-share` 是一个 **Agent Skill**,教 AI 编码助手(Claude Code / Cursor / Codex)正确调用 `@unif/react-native-umeng` 的 API、避免常见幻觉。

它把友盟分享与统计的关键约定、易错点和参考索引打包给 AI,让助手在你的项目里写代码时按真实 API 来,而不是凭记忆瞎猜。

## 覆盖什么

**何时会触发:** 用 `@unif/react-native-umeng` 做友盟分享(微信会话 / 钉钉)与统计——分享面板、埋点 `onEvent`、登录登出统计、PIPL 两段式初始化,或排查分享无回调 / init 顺序 / cancel。

**覆盖的能力:**

- U-Share 分享:`ShareSheetHost` 挂载 + `openSheet`,success-only 返回、取消 / 失败 reject,以及 session / owner 生命周期。
- PIPL 两段式初始化:`preInit` 只存 JS 快照 → 同意 → 无参 `init`,顺序不能反。当前 Android 已实现,iOS remediation 状态以仓库文档为准。
- U-App 统计:`onEvent` 埋点、登录 / 登出,方法是同步 void、别 await。
- 易错点:cancel/failure 误当 resolve、`init` 带参、忘挂 Host、依赖 / Worklets plugin、原生回调与 umeng `Platform` / RN `Platform` 混用。

> 朋友圈 / QQ / 微博首版不支持(只有微信会话 + 钉钉);拍照 / 扫码各有专门 skill。

## 如何安装

**Claude Code 插件市场:**

```bash
/plugin marketplace add unif-design/skills
/plugin install unif@skills
```

**或用 skills CLI:**

```bash
npx skills add unif-design/skills
```

## 在 GitHub 查看

skills 全部开源,发布在插件市场仓库 `unif-design/skills`。本 skill 的源码与参考文档:

👉 **[github.com/unif-design/skills · umeng-share](https://github.com/unif-design/skills/tree/main/skills/umeng-share)**

---

装了之后,在你的项目里让 AI 写 `@unif/react-native-umeng` 代码会更准。
