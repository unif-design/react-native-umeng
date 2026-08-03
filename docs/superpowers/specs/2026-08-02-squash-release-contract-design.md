# Squash Release Contract Design

## 背景

PR #66 在分支上通过了 `verify:publish-contract`，但 squash 合并到 `main` 后，
`Project Validation / consumer` 与 `Release` 同时失败：

- 最新 tag 与 `package.json` 都是 `0.3.3`。
- 公共 API、native runtime 与 peer contract 变更要求至少发布 minor `0.4.0`。
- 分支历史包含 `feat:` commit，因此 PR checkout 上的 release-it 计算为 minor。
- GitHub squash 后只留下 `fix: complete repository-wide contract remediation (#66)`
  这一条主提交，release-it 在 `main` 上计算为 patch `0.3.4`。

这不是 CI 抖动。本地 `main` 执行 `yarn verify:publish-contract` 可稳定复现同一错误。

## 目标

1. PR 合并前按最终 squash commit 的标题验证版本级别，避免分支 commit 历史掩盖
   低级别 PR 标题。
2. GitHub squash commit 标题始终取 `PR_TITLE`，使 PR 门禁与 `main` 上 release-it
   看到的 subject 一致。
3. 修复后继续由合并触发的 Release workflow 自动选择、提交并发布 `0.4.0`。
4. 不手工修改 npm version，不创建 tag，不执行 `npm publish`，也不依赖应急
   `workflow_dispatch`。

## 非目标

- 不改变公共 JS / native API、类型、mock 或消费者安装契约。
- 不改变 Angular conventional-changelog preset。
- 不新增人工版本文件或 changeset 系统。
- 不把文件级发布下限静默提升为最终版本；标题与变更不一致时仍明确失败。

## 方案比较

### 方案 A：手动 dispatch `increment=minor`

可以立即发布 `0.4.0`，但下一次大型 PR 仍可能在合并后失败，并且属于应急发布路径。
不采用。

### 方案 B：自动把 release-it 结果提升到文件级最低版本

能避免失败，但会隐藏 PR 标题与实际变更语义不一致，CHANGELOG 分类仍可能错误。
不采用。

### 方案 C：预先验证最终 squash 标题（采用）

`verify-publish-contract.mjs` 增加 `--squash-title`。脚本先按当前文件变化计算
`minimumReleaseLevel`，再按仓库现用 Angular preset 的 subject 语义判断标题：

- `feat:` / `feat(scope):` 对应 minor。
- 其他合法、非 breaking subject 对应 patch。
- 当前文件分类器最高要求 minor；major 仍由现有 commit body 中的
  `BREAKING CHANGE` 和 release-it 处理。

若标题级别低于文件契约，PR 直接失败并提示改用 `feat:`。Project Validation 在
`pull_request` 时通过环境变量传入标题，在 `push` / `merge_group` 时继续按真实
commit 历史验证。

## 数据流

```text
PR files since latest tag
        │
        ▼
minimumReleaseLevel ───────┐
                           ├─ compare ── fail before merge
PR_TITLE ── title level ───┘
        │
        ▼
squash commit subject on main
        │
        ▼
release-it recommended bump + existing publish contract
```

仓库设置同步改为：

- `squash_merge_commit_title = PR_TITLE`
- `squash_merge_commit_message = COMMIT_MESSAGES`（保持不变）

这样单 commit 与多 commit PR 都以经过门禁的 PR 标题作为最终 subject。

## 错误语义

标题不足时输出以下事实，不做自动修正：

- 原始 squash title。
- 标题推导级别。
- 文件契约最低级别。
- 使用 `feat:` 标题的修复建议。

非法标题由既有 `PR Title` workflow 继续负责；publish contract 也会防御性拒绝
无法解析的 `--squash-title`。

## 测试

TDD 回归覆盖：

1. `fix:` 标题在 minimum 为 minor 时失败。
2. `feat:` 与 `feat(scope):` 在 minimum 为 minor 时通过。
3. `fix:` 在 minimum 为 patch 时通过。
4. 非 Conventional Commit 标题被拒绝。
5. CLI 正确解析带空格的 `--squash-title`。
6. 原有 release-validation 16 项测试全部继续通过。

受影响门禁：

- `yarn verify:release-validation`
- `yarn verify:publish-contract --increment minor --squash-title "feat(ci): enforce squash release contract"`
- `yarn lint`
- `yarn typecheck`
- `yarn test`
- `yarn prepare`
- `yarn verify:dependencies`
- `yarn verify:package`
- `yarn verify:consumers`
- actionlint / Project Validation / Release

## 文档与 Skill 联动

`CONTRIBUTING.md` 补充 squash PR 标题必须覆盖发布级别。该变更不修改公共 API、
类型、运行时行为、错误语义、依赖、安装、原生配置、mock 或消费者示例，因此
website、`llms.txt` / `llms-full.txt` 与 `umeng-share` Skill 不应产生内容变更；
交付前仍运行生成器并核对 diff。

## 交付

修复 PR 使用标题 `feat(ci): enforce squash release contract`。CI 全绿后 squash
合并，使 `main` 上 release-it 看到 minor subject，并由既有 Release workflow 自动
发布 `0.4.0`。随后验证 npm dist-tag、GitHub Release、tag、release commit 与 docs
deploy 均对应同一版本和 commit。
