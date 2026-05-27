## 变更概述

<!-- 1-2 句:做了什么 / 为什么。链接 issue 用 `Closes #N`。 -->

## 类型

<!-- conventional-commits 类型,跟 commit msg 对齐。多选用 - [x] -->

- [ ] `feat` 新功能(会触发 minor 发版)
- [ ] `fix` Bug 修复(会触发 patch 发版)
- [ ] `refactor` / `chore` / `docs` / `test` / `ci`(不发版)
- [ ] **包含 BREAKING CHANGE**(会触发 major 发版,在 commit body 写 `BREAKING CHANGE: ...`)

## 验证

- [ ] `yarn lint`
- [ ] `yarn typecheck`
- [ ] `yarn test`
- [ ] (若改了 native module)在 `example/` 跑过微信/钉钉分享、PIPL `Common.init()` 流程
- [ ] (若改了 ShareSheet UI)在亮 + 暗主题下都看了
- [ ] (若改了原生依赖)`yarn turbo run build:android` / `build:ios` 通过

## 影响范围 / 注意点

<!-- TurboModule 签名变化?Native SDK 版本 bump?宿主集成步骤是否要更新 README? -->
