# Squash Release Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PR 合并前验证最终 squash 标题的 release level，并让自动 Release 正确发布 `0.4.0`。

**Architecture:** 在现有 `verify-publish-contract.mjs` 内增加纯函数式 squash title level 检查，复用现有文件级 `minimumReleaseLevel`，不改变 release-it 的版本计算。Project Validation 仅在 PR 上传入标题；GitHub 仓库设置固定以 `PR_TITLE` 生成 squash subject。

**Tech Stack:** Node.js 24、`node:test`、Yarn 4.11、GitHub Actions、release-it 21、Angular conventional-changelog preset、GitHub CLI。

## Global Constraints

- `main` 只通过 PR + CI 合入，禁止直接推送。
- 不手工修改 npm version、创建 tag、执行 `npm publish` 或应急 workflow dispatch。
- 修复 PR 和最终 squash commit 标题均为 `feat(ci): enforce squash release contract`。
- `squash_merge_commit_title` 固定为 `PR_TITLE`；`squash_merge_commit_message` 保持 `COMMIT_MESSAGES`。
- 只修改 release validation、Project Validation、贡献文档和本次 spec / plan。
- 公共 API、native、依赖、website、llms.txt 与 `umeng-share` Skill 不发生语义变化。

---

### Task 1: 为 squash title release level 写失败回归

**Files:**
- Modify: `scripts/__tests__/release-validation.test.mjs`
- Test: `scripts/__tests__/release-validation.test.mjs`

**Interfaces:**
- Consumes: `minimumReleaseLevel` 现有返回值 `none | patch | minor`。
- Produces: 期望导出的 `squashTitleReleaseLevel(title)` 与 `assertSquashTitleReleaseLevel({ title, minimumLevel })`。

- [ ] **Step 1: 写入失败测试**

```js
test('squash title must cover the file-based release floor', () => {
  assert.equal(squashTitleReleaseLevel('fix: close callback race'), 'patch');
  assert.equal(squashTitleReleaseLevel('feat(ci): enforce release floor'), 'minor');
  assert.throws(
    () =>
      assertSquashTitleReleaseLevel({
        title: 'fix: close callback race',
        minimumLevel: 'minor',
      }),
    /squash title.*patch.*minor.*feat:/s
  );
  assert.doesNotThrow(() =>
    assertSquashTitleReleaseLevel({
      title: 'feat(ci): enforce release floor',
      minimumLevel: 'minor',
    })
  );
});
```

- [ ] **Step 2: 运行 RED**

Run:

```sh
yarn verify:release-validation
```

Expected: FAIL，因为两个新导出尚不存在。

- [ ] **Step 3: 增加 CLI 解析回归**

扩展 `parsePublishContractArgs` 现有测试，输入：

```js
[
  '--increment',
  'minor',
  '--squash-title',
  'feat(ci): enforce squash release contract',
  '--github-output',
  '/tmp/github-output',
]
```

期望返回：

```js
{
  githubOutput: '/tmp/github-output',
  increment: 'minor',
  squashTitle: 'feat(ci): enforce squash release contract',
}
```

- [ ] **Step 4: 再次运行 RED**

Run:

```sh
yarn verify:release-validation
```

Expected: FAIL，错误来自缺少 `--squash-title` 支持，而不是语法或 fixture。

### Task 2: 实现最小 publish contract 修复

**Files:**
- Modify: `scripts/verify-publish-contract.mjs`
- Test: `scripts/__tests__/release-validation.test.mjs`

**Interfaces:**
- Consumes: `title: string`、`minimumLevel: 'none' | 'patch' | 'minor'`。
- Produces: `squashTitleReleaseLevel(title): 'patch' | 'minor'` 与 `assertSquashTitleReleaseLevel(...)`。

- [ ] **Step 1: 实现标题级别解析**

使用 Conventional Commit subject 正则，仅把 Angular preset 可识别的 `feat:` /
`feat(scope):` 判为 minor，其余合法类型判为 patch；非法标题抛出带原始标题的错误。

- [ ] **Step 2: 实现最低级别断言**

在现有 `minimumRelease` 计算完成后、成功输出前执行：

```js
if (squashTitle) {
  assertSquashTitleReleaseLevel({ title: squashTitle, minimumLevel });
}
```

当 `patch < minor` 时输出 title、title level、minimum required 和 `feat:` 建议。

- [ ] **Step 3: 支持 CLI 参数**

`parsePublishContractArgs` 接受：

```text
--squash-title <完整 PR 标题>
```

未知参数与缺值继续返回非零。

- [ ] **Step 4: 运行 GREEN**

Run:

```sh
yarn verify:release-validation
```

Expected: 全部通过，测试数从 16 增加。

- [ ] **Step 5: 验证真实失败与显式 minor 成功**

Run:

```sh
yarn verify:publish-contract --increment minor --squash-title "fix: complete repository-wide contract remediation"
```

Expected: FAIL，明确报告 title level `patch` 低于 `minor`。

Run:

```sh
yarn verify:publish-contract --increment minor --squash-title "feat(ci): enforce squash release contract"
```

Expected: PASS，computed version 为 `0.4.0`。

### Task 3: 接入 PR workflow 与贡献文档

**Files:**
- Modify: `.github/workflows/project-validation.yml`
- Modify: `CONTRIBUTING.md`
- Test: `scripts/__tests__/release-validation.test.mjs`

**Interfaces:**
- Consumes: `${{ github.event.pull_request.title }}`，通过 env 进入 shell。
- Produces: PR consumer job 调用 `--squash-title`；push / merge_group 保持无参数调用。

- [ ] **Step 1: 扩展 pull_request 事件**

把 `pull_request` 配置为：

```yaml
pull_request:
  branches:
    - main
  types:
    - opened
    - edited
    - reopened
    - synchronize
```

标题修改会重新计算门禁。

- [ ] **Step 2: 安全传入标题**

通过 env 而不是直接插值到 shell：

```yaml
env:
  SQUASH_TITLE: ${{ github.event.pull_request.title }}
run: |
  if [ -n "$SQUASH_TITLE" ]; then
    yarn verify:publish-contract --squash-title "$SQUASH_TITLE"
  else
    yarn verify:publish-contract
  fi
```

- [ ] **Step 3: 更新贡献说明**

在 `CONTRIBUTING.md` 的 Conventional Commits / 发布章节说明：squash 后 PR 标题是
release commit subject；触及 minor 契约时标题必须使用 `feat:`，CI 会在合并前拒绝
`fix:`。

- [ ] **Step 4: 验证 workflow 与测试**

Run:

```sh
yarn verify:release-validation
actionlint .github/workflows/project-validation.yml
```

Expected: 全部通过。

### Task 4: 完整验证与联动核对

**Files:**
- Verify only: `website/`
- Verify only: `website/static/llms.txt`
- Verify only: `website/static/llms-full.txt`
- Verify only: `../skills/skills/umeng-share/`

**Interfaces:**
- Consumes: 完成后的任务分支。
- Produces: 可提交的 clean validation evidence。

- [ ] **Step 1: 运行库门禁**

```sh
yarn lint
yarn typecheck
yarn test
yarn prepare
yarn verify:release-validation
yarn verify:dependencies
yarn verify:package
yarn verify:consumers
yarn verify:publish-contract --increment minor --squash-title "feat(ci): enforce squash release contract"
```

Expected: 全部退出 0。

- [ ] **Step 2: 运行文档生成器并核对 diff**

```sh
yarn workspace @unif/react-native-umeng-website build:llms
git status --short
git diff -- website/static/llms.txt website/static/llms-full.txt
```

Expected: llms 输出无变化。

- [ ] **Step 3: 核对 Skill**

确认本次不改变 `umeng-share` 的公共 API、安装、native setup、mock、示例或排障契约，
因此 `../skills/skills/umeng-share/` 无需修改。

- [ ] **Step 4: review diff**

```sh
git diff --check
git diff --stat
git status --short --branch
```

Expected: 仅包含本计划列出的文件。

### Task 5: 提交、仓库设置、PR 与合并

**Files:**
- Commit: 本计划列出的 repository files
- External setting: `unif-design/react-native-umeng` squash merge title

**Interfaces:**
- Consumes: 已验证提交。
- Produces: Ready PR、绿色 CI、合并后的 minor release commit。

- [ ] **Step 1: conventional commit**

```sh
git add \
  .github/workflows/project-validation.yml \
  CONTRIBUTING.md \
  docs/superpowers/specs/2026-08-02-squash-release-contract-design.md \
  docs/superpowers/plans/2026-08-02-squash-release-contract.md \
  scripts/__tests__/release-validation.test.mjs \
  scripts/verify-publish-contract.mjs
git commit -m "feat(ci): enforce squash release contract"
```

- [ ] **Step 2: 提交后验证真实 auto 计算**

```sh
yarn verify:publish-contract --squash-title "feat(ci): enforce squash release contract"
```

Expected: PASS，computed version 为 `0.4.0`。

- [ ] **Step 3: 固定 GitHub squash title 设置**

通过 GitHub API 把 `squash_merge_commit_title` 改为 `PR_TITLE`，保持
`squash_merge_commit_message=COMMIT_MESSAGES`，随后回读验证。

- [ ] **Step 4: push 并创建 PR**

PR 标题：

```text
feat(ci): enforce squash release contract
```

PR body 包含 run #30774530920、Project Validation run #30774530917、本地 RED /
GREEN 证据和“不手工发布”的边界。

- [ ] **Step 5: 等待 CI 与 review**

Required CI 全部成功后才执行 squash merge；使用 expected head SHA 防竞态。

### Task 6: 跟踪自动发布

**Files:**
- External verification only

**Interfaces:**
- Consumes: 修复 PR 的 squash merge commit。
- Produces: npm、GitHub Release、tag、release commit 与 docs deploy 终态证据。

- [ ] **Step 1: 等待 Release workflow**

确认 publish contract 选择 `0.4.0`，release-it 成功完成。

- [ ] **Step 2: 核对发布产物**

核对：

- npm `@unif/react-native-umeng@0.4.0`
- tag `v0.4.0`
- GitHub Release `v0.4.0`
- `main` 上 `chore: release 0.4.0 [skip ci]`
- Deploy Docs 成功且文档版本刷新

- [ ] **Step 3: 最终报告**

报告两个原 PR、修复 PR、merge SHA、release SHA、workflow URLs、版本和仍需真机验证的
微信 / 钉钉边界。
