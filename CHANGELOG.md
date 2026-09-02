# Changelog

# [0.8.0](https://github.com/unif-design/react-native-umeng/compare/v0.7.0...v0.8.0) (2026-09-02)

### Features

* 兼容 Reanimated 4.6 与 RN 0.86.3 ([#95](https://github.com/unif-design/react-native-umeng/issues/95)) ([8f5885d](https://github.com/unif-design/react-native-umeng/commit/8f5885dc7e865aa37bf773982743a4cda16e913b))

# [0.7.0](https://github.com/unif-design/react-native-umeng/compare/v0.6.1...v0.7.0) (2026-08-14)

### Bug Fixes

* **release:** 契约无变更时不发版 ([#83](https://github.com/unif-design/react-native-umeng/issues/83)) ([19f8f33](https://github.com/unif-design/react-native-umeng/commit/19f8f336590b83ba223310c7756d4f07cdb36c66))

### Features

* peer 标定 RN >=0.86.0,design 抬到 >=0.26.0 并去掉上限 ([#91](https://github.com/unif-design/react-native-umeng/issues/91)) ([3e8a7e2](https://github.com/unif-design/react-native-umeng/commit/3e8a7e2f6dfd98c00da5c018ee093a5b3f62fe9d))

## [0.6.1](https://github.com/unif-design/react-native-umeng/compare/v0.6.0...v0.6.1) (2026-08-06)

# [0.6.0](https://github.com/unif-design/react-native-umeng/compare/v0.5.0...v0.6.0) (2026-08-05)

### Features

* 放宽 design peer 到 >=0.21.0 <1.0.0 ([#80](https://github.com/unif-design/react-native-umeng/issues/80)) ([9f9b5d5](https://github.com/unif-design/react-native-umeng/commit/9f9b5d58cd89801d6e00254ab994d60d6e5ea868))

# [0.5.0](https://github.com/unif-design/react-native-umeng/compare/v0.4.2...v0.5.0) (2026-08-05)

### Features

* design 升到 ^0.21.1,peer 契约随之收紧 ([#79](https://github.com/unif-design/react-native-umeng/issues/79)) ([d60ca12](https://github.com/unif-design/react-native-umeng/commit/d60ca1245e2252a9b869f511cf0944479e90f0b0))

## [0.4.2](https://github.com/unif-design/react-native-umeng/compare/v0.4.1...v0.4.2) (2026-08-05)

## [0.4.1](https://github.com/unif-design/react-native-umeng/compare/v0.4.0...v0.4.1) (2026-08-03)

### Bug Fixes

* **docs:** sync Android CI evidence ([#76](https://github.com/unif-design/react-native-umeng/issues/76)) ([ab23e69](https://github.com/unif-design/react-native-umeng/commit/ab23e6995636b4e24525ed67bd76438e2452a709))

# [0.4.0](https://github.com/unif-design/react-native-umeng/compare/v0.3.3...v0.4.0) (2026-08-03)

### Bug Fixes

* complete repository-wide contract remediation ([#66](https://github.com/unif-design/react-native-umeng/issues/66)) ([79f351a](https://github.com/unif-design/react-native-umeng/commit/79f351ae87f969c4fdfe1becc2430d69f4799c7a))

### Features

* **ci:** align release trigger paths ([#73](https://github.com/unif-design/react-native-umeng/issues/73)) ([20bbe14](https://github.com/unif-design/react-native-umeng/commit/20bbe146ac857dc38ce76089129673d25bcd63a1))
* **ci:** enforce exact release trigger allowlist ([#75](https://github.com/unif-design/react-native-umeng/issues/75)) ([0141039](https://github.com/unif-design/react-native-umeng/commit/014103989557e5aa472ed627124b453ea7dd82d1))
* **ci:** enforce squash release contract ([#72](https://github.com/unif-design/react-native-umeng/issues/72)) ([80e6252](https://github.com/unif-design/react-native-umeng/commit/80e62524bc195fa75b407ac41d56eb8d406b58f4))

## Unreleased

### Breaking changes / migration

- 分享公共结果收敛为 success-only：`Share.openSheet` 与 `shareText` / `shareImage` / `shareLink` 仅成功时 resolve；取消、失败和未安装平台改为 reject `UmengError`。
- peer 基线对齐 design 0.20：RNGH `>=3 <4`、Reanimated `^4.5.3`、Worklets `^0.11.3` 及其余 UI peers 均须由消费者安装；Community CLI 的 Babel 配置改用 `react-native-worklets/plugin` 且必须放最后。
- `Common.preInit(config)` 改为纯 JS 配置校验、标准化与快照缓存，授权前零 native/vendor 调用；用户同意后调用无参 `Common.init()`，Share 在 init 前 reject `E_NOT_INITIALIZED`，Analytics 在 init 前同步 no-op。
- Android 回调 Activity 改为宿主包名下默认 disabled、授权初始化成功后按平台动态启用；library 合并窄 FileProvider。撤回同意没有公共 revoke API，须受控禁用回调组件并完整重启进程。
- iOS 重建单次 `initialize(config)` bootstrap、Share/Analytics init gate、TurboModule provider 和 AppDelegate/SceneDelegate 双路回调转发。simulator build/XCTest/native contract 已通过；真实微信/钉钉 URL Scheme 与 Universal Link/AASA 回跳仍须真机验证。

## [0.3.3](https://github.com/unif-design/react-native-umeng/compare/v0.3.2...v0.3.3) (2026-07-16)

## [0.3.2](https://github.com/unif-design/react-native-umeng/compare/v0.3.1...v0.3.2) (2026-06-08)

## [0.3.1](https://github.com/unif-design/react-native-umeng/compare/v0.3.0...v0.3.1) (2026-06-08)

# [0.3.0](https://github.com/unif-design/react-native-umeng/compare/v0.2.1...v0.3.0) (2026-06-06)


### Bug Fixes

* **nightly:** job 改名 -next 避免撞 ci.yml required + PR 不跑 build + RN_NEXT semver 校验 ([#31](https://github.com/unif-design/react-native-umeng/issues/31)) ([8ef3021](https://github.com/unif-design/react-native-umeng/commit/8ef302107f69bccb60b84179c73e72f7727978a9))
* **website:** build-llms review 加固 + 建 CLAUDE.md [@import](https://github.com/import) AGENTS.md ([#39](https://github.com/unif-design/react-native-umeng/issues/39)) ([e6cb04c](https://github.com/unif-design/react-native-umeng/commit/e6cb04ce4ca14f70a641b0b75bbbd4408edce1f6))
* **website:** build-llms 升 path.resolve 路径遍历加固 ([#38](https://github.com/unif-design/react-native-umeng/issues/38)) ([f08e81e](https://github.com/unif-design/react-native-umeng/commit/f08e81e86935755b19ca8afdff517768b41d5636))


### Features

* **llms:** sync generator (index desc/TOC/LiveDemo/order) ([#46](https://github.com/unif-design/react-native-umeng/issues/46)) ([86bb322](https://github.com/unif-design/react-native-umeng/commit/86bb322a88093fe5858154311f64fb6558716502))
* **share:** 移除 [@gorhom](https://github.com/gorhom) 依赖,分享面板改用 RN Modal ([26975f6](https://github.com/unif-design/react-native-umeng/commit/26975f68089ef931ea86f7888873f0c876e04c6b))
* **website:** llms.txt 标准化(复制 design build-llms) ([#36](https://github.com/unif-design/react-native-umeng/issues/36)) ([a1a50c8](https://github.com/unif-design/react-native-umeng/commit/a1a50c87671746153fb971045c2789b03c9855fe))
* **website:** umeng 站首页重构(代码+分享面板 hero,引 docs-home.css) ([#41](https://github.com/unif-design/react-native-umeng/issues/41)) ([11c6be5](https://github.com/unif-design/react-native-umeng/commit/11c6be54fd0fb9e3d8c4ad1f95756e11faee1905)), closes [#07C160](https://github.com/unif-design/react-native-umeng/issues/07C160) [#1677FF](https://github.com/unif-design/react-native-umeng/issues/1677FF)

## [0.2.1](https://github.com/unif-design/react-native-umeng/compare/v0.2.0...v0.2.1) (2026-06-02)

# [0.2.0](https://github.com/unif-design/react-native-umeng/compare/v0.1.4...v0.2.0) (2026-05-28)


### Features

* jest mock export ([#19](https://github.com/unif-design/react-native-umeng/issues/19)) ([095bb89](https://github.com/unif-design/react-native-umeng/commit/095bb89ced9f2aab8636a30d812d89602aeb7e6c))

## [0.1.4](https://github.com/unif-design/react-native-umeng/compare/v0.1.3...v0.1.4) (2026-05-28)


### Bug Fixes

* ios 公开 UmengBootstrap.h header + 评审跟进 ([#16](https://github.com/unif-design/react-native-umeng/issues/16)) ([67f4517](https://github.com/unif-design/react-native-umeng/commit/67f4517669cc8f2168854ecbe33879e465692e6a))

## [0.1.3](https://github.com/unif-design/react-native-umeng/compare/v0.1.2...v0.1.3) (2026-05-28)

## [0.1.2](https://github.com/unif-design/react-native-umeng/compare/v0.1.0...v0.1.2) (2026-05-28)

# [0.1.1](https://github.com/unif-design/react-native-umeng/compare/v0.1.0...v0.1.1) (2026-05-28)


### Features

* platform brand colors ([#11](https://github.com/unif-design/react-native-umeng/issues/11)) ([8c7f9ea](https://github.com/unif-design/react-native-umeng/commit/8c7f9ea52a045eec400c39f541fe54f2cd475bc3))
