# Release Trigger Parity Design

## 背景

PR #72 已在全部 required checks 通过后 squash 合并为
`80e62524bc195fa75b407ac41d56eb8d406b58f4`，最终 subject 正确使用
`feat(ci): enforce squash release contract (#72)`。但该 push 只触发了 CI、
Project Validation 与 Native Lint，没有触发 Release。

这不是 Actions 延迟。GitHub 对 `push.paths` 使用 push 前后 SHA 的 changed files
做匹配，至少一个文件命中才运行 workflow。PR #72 只修改
`.github/workflows/project-validation.yml`、`CONTRIBUTING.md`、
`docs/superpowers/**` 与 `scripts/**`；当前 Release paths 没有 `scripts/**`，
所以该 workflow 被确定性跳过。

同组织的 Design 与 Camera release workflow 已把 `scripts/**` 视为发布流程输入。
Umeng 的发布验证、包审计、消费者 smoke 与版本选择也都由 `scripts/` 实现，
因此当前 native 仓 paths 与实际 release 数据流不一致。

## 目标

1. 将 `scripts/**` 加入 Release 的 `push.paths`，与实际发布验证输入和 Design
   的既有模式对齐。
2. 用自动化回归锁定该路径，防止后续共享 workflow 同步再次静默删除。
3. follow-up PR 合并时，由其 `scripts/**` 回归测试变更命中新 paths，自动触发
   Release，并让已有 Conventional Commit 历史选择 `0.4.0`。
4. 保持 PR #72 已落地的 squash title guard 与仓库 `PR_TITLE` 设置不变。

## 非目标

- 不使用 `workflow_dispatch`、不重跑旧失败的 Release run。
- 不手工修改 `package.json#version`、创建 tag 或执行 npm publish。
- 不通过无意义的 `src/` 改动制造触发。
- 不改变公共 API、类型、native runtime、依赖、mock、消费者示例、website、
  llms 输出或 `umeng-share` Skill。
- 不在本任务中回退或重写另一会话正在进行的其他共享 workflow 同步内容。

## 采用方案

在 `.github/workflows/release.yml` 的 `on.push.paths` 中增加：

```yaml
- 'scripts/**'
```

在 `scripts/__tests__/release-validation.test.mjs` 增加回归，读取
`.github/workflows/release.yml` 并断言：

- Release 仍由 `push` 到 `main` 触发。
- paths 明确包含 `scripts/**`。

测试文件本身位于 `scripts/**`，因此 follow-up PR 的 merge push 会匹配新路径；
GitHub 将使用合并后版本的 workflow 启动 Release。release-it 看到自
`v0.3.3` 以来的 `feat:` squash subject，自动选择 minor `0.4.0`。

## 备选方案

### 把 `.github/workflows/release.yml` 自身加入 paths

可以让 workflow-only 修改触发发布，但以后纯 release 配置维护也会发布 npm 包，
范围比本问题需要的大，不采用。

### 手动 dispatch minor

能立即发布 `0.4.0`，但绕过自动触发根因且违反已批准的交付约束，不采用。

### 修改 `src/` 或 `package.json` 制造触发

会制造无业务意义的发布内容，且不能防止下次 `scripts/**` 漂移，不采用。

## 错误与安全边界

- 回归测试必须在缺少 `scripts/**` 时真实失败，不能只检查任意 `scripts` 文本。
- workflow path 使用仓库相对 glob，不引入全局 catch-all。
- release commit 仍依赖 `[skip ci]` 与 job-level guard 防止自触发循环。
- PR 仍需 Project Validation、actionlint、native CI 与 PR title guard 全绿后合并。
- 若另一会话的 workflow 同步与本规格产生真实语义冲突，合并前必须显式报告，
  不得静默覆盖任一方。

## 验证与交付

本地至少运行：

```sh
yarn verify:release-validation
actionlint .github/workflows/release.yml
yarn lint
yarn typecheck
yarn test --maxWorkers=2
yarn prepare
yarn verify:dependencies
yarn verify:package
yarn verify:consumers
yarn verify:publish-contract --squash-title "feat(ci): align release trigger paths"
```

同时重新生成 llms 并确认无 diff，核对 `umeng-share` Skill 不受影响。PR 标题固定为
`feat(ci): align release trigger paths`。CI 全绿后 squash 合并，再验证：

1. merge SHA 确实产生 Release run。
2. Release 自动选择并发布 `0.4.0`。
3. `main` 上出现 release commit 与 `v0.4.0` tag。
4. npm `latest`、GitHub Release、tag、release commit 和 docs deploy 指向一致版本。
