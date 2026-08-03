# Release Trigger Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `scripts/**` 发布验证变更在合入 `main` 后自动触发 Release，并由现有发布链路产出 `0.4.0`。

**Architecture:** 在现有 release-validation 测试中把 Release workflow 的 `push.paths` 作为可执行契约读取和断言，再对 `.github/workflows/release.yml` 做单行路径补齐。测试文件自身位于 `scripts/**`，因此该 PR 合并时会命中新路径并触发自动 Release，不需要手工 dispatch 或制造业务源码改动。

**Tech Stack:** Node.js 24、`node:test`、Yarn 4.11、GitHub Actions、actionlint 1.7.12、release-it 21、GitHub CLI。

## Global Constraints

- `main` 只通过 PR + required CI 合入，禁止直接 push。
- 不使用 `workflow_dispatch`，不手工修改 npm version、创建 tag 或执行 npm publish。
- PR 标题与最终 squash subject 固定为 `feat(ci): align release trigger paths`。
- 只新增 `scripts/**` Release path 和对应回归；不改公共 API、类型、native runtime、依赖、mock 或消费者契约。
- 保留当前分支已有的 `ci: validate website contract` 提交，不回退、覆盖或重写另一会话的 `.github/workflows/ci.yml`。
- website、llms 与 `umeng-share` Skill 只核对影响；无公共契约变化时不得制造内容 diff。

---

### Task 1: 以 TDD 锁定 Release scripts 路由

**Files:**
- Modify: `scripts/__tests__/release-validation.test.mjs`
- Modify: `.github/workflows/release.yml`
- Test: `scripts/__tests__/release-validation.test.mjs`

**Interfaces:**
- Consumes: `.github/workflows/release.yml` 中 `on.push` 到 `workflow_dispatch` 之间的 YAML 文本。
- Produces: 测试 `release workflow runs when release-validation scripts change`，要求 `push` 目标包含 `main` 且 paths 精确包含 `scripts/**`。

- [ ] **Step 1: 写入失败回归**

在 `website validation runs the cross-workspace dependency verifier` 测试后加入：

```js
test('release workflow runs when release-validation scripts change', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  );
  const pushTrigger = workflow
    .split(/^  push:/m)[1]
    ?.split(/^  workflow_dispatch:/m)[0];

  assert.match(pushTrigger ?? '', /branches:\s*\[main\]/);
  assert.match(pushTrigger ?? '', /^\s{6}- 'scripts\/\*\*'$/m);
});
```

- [ ] **Step 2: 运行 RED**

Run:

```sh
yarn verify:release-validation
```

Expected: 新测试失败，错误明确显示 `pushTrigger` 中没有精确的
`      - 'scripts/**'`；既有 18 项继续通过。

- [ ] **Step 3: 实现最小修复**

在 `.github/workflows/release.yml` 的 `on.push.paths` 中紧接 `src/**` 增加：

```yaml
      - 'src/**'
      - 'scripts/**'
      - 'ios/**'
```

不修改 workflow 的 Verify、publish contract、Release、权限、并发或防循环逻辑。

- [ ] **Step 4: 运行 GREEN 与 workflow lint**

Run:

```sh
yarn verify:release-validation
/private/tmp/actionlint-1.7.12/actionlint -color .github/workflows/*.yml
```

Expected: release-validation 19/19 通过，actionlint 退出 0。

- [ ] **Step 5: 检查最小 diff**

Run:

```sh
git diff --check
git diff -- .github/workflows/release.yml scripts/__tests__/release-validation.test.mjs
git status --short --branch
```

Expected: 本任务实现只修改两个目标文件；另一会话的已提交
`.github/workflows/ci.yml` 不出现在未提交 diff。

### Task 2: 完整验证、联动核对与提交

**Files:**
- Verify only: `website/`
- Verify only: `website/static/llms.txt`
- Verify only: `website/static/llms-full.txt`
- Verify only: `../skills/skills/umeng-share/`
- Commit: `.github/workflows/release.yml`
- Commit: `scripts/__tests__/release-validation.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 GREEN tree 与当前分支已有 website CI commit。
- Produces: conventional commit `feat(ci): align release trigger paths` 和可推送的 clean task diff。

- [ ] **Step 1: 运行库与 website 门禁**

Run:

```sh
yarn lint
yarn typecheck
yarn test --maxWorkers=2
yarn prepare
yarn verify:release-validation
yarn verify:dependencies
yarn verify:package
yarn verify:consumers
node website/scripts/build-llms.test.js
yarn workspace @unif/react-native-umeng-website typecheck
yarn workspace @unif/react-native-umeng-website build
yarn verify:agent-instructions
```

Expected: 全部退出 0；Jest 161 项通过，release-validation 19 项通过，website
生产构建成功。

- [ ] **Step 2: 验证发布选择与原故障路径**

Run:

```sh
yarn verify:publish-contract --squash-title "feat(ci): align release trigger paths"
```

Expected: `increment=auto computed=0.4.0 minimum=minor (0.4.0)`。

Run:

```sh
yarn verify:publish-contract --squash-title "fix(ci): align release trigger paths"
```

Expected: 非零退出，明确报告 `title level: patch` 低于 `minimum required: minor`。

- [ ] **Step 3: 核对 llms 与 Skill 无漂移**

Run:

```sh
git diff -- website/static/llms.txt website/static/llms-full.txt
git -C ../skills status --short --branch
rg -n "release|publish|push.paths" ../skills/skills/umeng-share
```

Expected: llms 无 diff；`umeng-share` 只描述消费者 API、原生接线与真机边界，
不需要加入仓库 release trigger 细节。

- [ ] **Step 4: 只暂存实现文件**

Run:

```sh
git add .github/workflows/release.yml scripts/__tests__/release-validation.test.mjs
git diff --cached --check
git diff --cached --name-only
```

Expected: cached 文件严格为上述两个路径。

- [ ] **Step 5: 创建实现提交并复验自动版本**

Run:

```sh
git commit -m "feat(ci): align release trigger paths"
yarn verify:publish-contract --squash-title "feat(ci): align release trigger paths"
git status --short --branch
```

Expected: commit 成功；auto 仍选择 `0.4.0`；工作树无本任务未提交文件。

### Task 3: PR、合并与自动发布闭环

**Files:**
- GitHub PR: current branch → `main`
- Verify only: `.github/workflows/release.yml`
- Verify only: npm `@unif/react-native-umeng@0.4.0`

**Interfaces:**
- Consumes: Task 2 的 implementation commit、仓库 `PR_TITLE` squash 设置和现有分支 PR（若已存在则更新，不重复创建）。
- Produces: 合并 commit、Release run、release commit、`v0.4.0` tag、npm `latest=0.4.0`、GitHub Release 与 docs deploy。

- [ ] **Step 1: 推送并创建或更新 PR**

Run:

```sh
git push -u origin ci/sync-shared-workflows
gh pr view ci/sync-shared-workflows \
  --repo unif-design/react-native-umeng \
  --json number,title,url,headRefOid
```

若已有 PR，使用以下精确标题与正文更新：

```sh
gh pr edit ci/sync-shared-workflows \
  --repo unif-design/react-native-umeng \
  --title "feat(ci): align release trigger paths" \
  --body "## Summary

- add scripts/** to the Release push path contract
- add a TDD regression for the missing Release trigger
- retain the existing website contract validation commit

## Root cause

PR #72 changed scripts/** but Release did not run because release.yml did not include scripts/** in push.paths.

## Verification

- yarn verify:release-validation (RED, then 19/19 GREEN)
- actionlint .github/workflows/*.yml
- yarn lint
- yarn typecheck
- yarn test --maxWorkers=2
- yarn prepare
- yarn verify:dependencies
- yarn verify:package
- yarn verify:consumers
- website llms/typecheck/build and agent instructions
- publish contract selects 0.4.0 for this feat title

Expected merge outcome: the scripts/** test change triggers Release automatically and publishes 0.4.0."
```

若 `gh pr view` 报告当前分支没有 PR，使用相同正文创建 ready-for-review PR：

```sh
gh pr create \
  --repo unif-design/react-native-umeng \
  --base main \
  --head ci/sync-shared-workflows \
  --title "feat(ci): align release trigger paths" \
  --body "## Summary

- add scripts/** to the Release push path contract
- add a TDD regression for the missing Release trigger
- retain the existing website contract validation commit

## Root cause

PR #72 changed scripts/** but Release did not run because release.yml did not include scripts/** in push.paths.

## Verification

- yarn verify:release-validation (RED, then 19/19 GREEN)
- actionlint .github/workflows/*.yml
- yarn lint
- yarn typecheck
- yarn test --maxWorkers=2
- yarn prepare
- yarn verify:dependencies
- yarn verify:package
- yarn verify:consumers
- website llms/typecheck/build and agent instructions
- publish contract selects 0.4.0 for this feat title

Expected merge outcome: the scripts/** test change triggers Release automatically and publishes 0.4.0."
```

- [ ] **Step 2: 等待并审查 required CI**

Run:

```sh
gh pr checks ci/sync-shared-workflows \
  --repo unif-design/react-native-umeng \
  --watch \
  --interval 20
```

Expected: actionlint、PR title、PR Agent、Project Validation 汇总及所有被选择的
JavaScript、consumer、Android、iOS、website、instructions job 全部 success；
skipped job 仅限 paths-filter 判定为不需要的 job。

- [ ] **Step 3: 锁定 SHA 后 squash merge**

先读取 PR 的 `headRefOid`、`mergeStateStatus`、标题与 checks。仅当标题精确匹配、
merge state 为 `CLEAN` 且 required checks 全绿时运行：

```sh
PR_NUMBER="$(gh pr view ci/sync-shared-workflows \
  --repo unif-design/react-native-umeng \
  --json number \
  --jq .number)"
HEAD_SHA="$(gh pr view ci/sync-shared-workflows \
  --repo unif-design/react-native-umeng \
  --json headRefOid \
  --jq .headRefOid)"
gh pr view "$PR_NUMBER" \
  --repo unif-design/react-native-umeng \
  --json number,title,headRefOid,mergeStateStatus,statusCheckRollup
gh pr merge "$PR_NUMBER" \
  --repo unif-design/react-native-umeng \
  --squash \
  --match-head-commit "$HEAD_SHA"
```

Expected: 不使用 `--admin`。合并后运行：

```sh
MERGE_SHA="$(gh pr view ci/sync-shared-workflows \
  --repo unif-design/react-native-umeng \
  --json mergeCommit \
  --jq .mergeCommit.oid)"
MERGE_SUBJECT="$(gh api \
  "repos/unif-design/react-native-umeng/commits/${MERGE_SHA}" \
  --jq '.commit.message | split("\n")[0]')"
test "$MERGE_SUBJECT" = \
  "feat(ci): align release trigger paths (#${PR_NUMBER})"
```

最终 squash subject 必须精确保留 `feat(ci):`，并带当前 PR 的实际编号。

- [ ] **Step 4: 确认 merge SHA 自动触发 Release**

Run:

```sh
MERGE_SHA="$(gh pr view ci/sync-shared-workflows \
  --repo unif-design/react-native-umeng \
  --json mergeCommit \
  --jq .mergeCommit.oid)"
gh run list \
  --repo unif-design/react-native-umeng \
  --commit "$MERGE_SHA" \
  --limit 20
```

Expected: 与 #72 不同，该 SHA 明确出现 `Release` push run；不得以
`workflow_dispatch` 补触发。

- [ ] **Step 5: 等待 Release 与 docs deploy**

Run:

```sh
RELEASE_RUN_ID="$(gh run list \
  --repo unif-design/react-native-umeng \
  --workflow release.yml \
  --commit "$MERGE_SHA" \
  --event push \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')"
test -n "$RELEASE_RUN_ID"
gh run watch "$RELEASE_RUN_ID" \
  --repo unif-design/react-native-umeng
```

Expected: Verify、publish contract、release-it、npm Trusted Publishing、GitHub
Release 和 docs dispatch 全部成功；随后对应 deploy-docs workflow success。

- [ ] **Step 6: 核对发布物一致性**

Run:

```sh
gh release view v0.4.0 --repo unif-design/react-native-umeng
gh api repos/unif-design/react-native-umeng/git/ref/tags/v0.4.0
yarn npm info @unif/react-native-umeng --json
```

Expected: npm latest 为 `0.4.0`；GitHub Release、tag、`main` 上
`chore: release 0.4.0 [skip ci]` commit 与发布 run 指向同一版本；docs deploy
来自 release 后对 `main` 的显式 dispatch。

- [ ] **Step 7: 记录验证边界**

最终交付说明必须包含：本次未改消费者运行时，website / llms / Skill 无内容变化；
CI 覆盖 Android release 与 iOS simulator/XCTest，但微信/钉钉真实拉起和回包仍按
既有约定留待真机验证。
