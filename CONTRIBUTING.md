# 参与贡献

感谢参与 `@unif/react-native-umeng`。请保持交流友善，并遵守
[Code of Conduct](./CODE_OF_CONDUCT.md)。组织级 CI、Dependabot、PR review 与分支保护
规则见 [AUTOMATION.md](https://github.com/unif-design/.github/blob/main/AUTOMATION.md)。

## 开发环境

本仓是 Yarn workspaces 单仓库：

- 根目录：React Native library。
- [`example/`](./example/)：真实宿主 React Native app。
- [`website/`](./website/)：Docusaurus 文档站。

Node.js 版本由 [`.nvmrc`](./.nvmrc) 固定，包管理器固定为 Yarn 4.11.0。安装依赖：

```sh
yarn install --immutable
```

开发、升级依赖和运行 workspace 命令都只使用 Yarn。`npm` 仅由验证与发布自动化内部调用：
verifier 在隔离 temp cache 中审计 tarball，release workflow 负责 OIDC 发布。不要用 npm
改依赖或生成 lockfile。

## 日常验证

从仓库根目录运行：

```sh
yarn lint
yarn typecheck
yarn test --maxWorkers=2
yarn prepare
yarn verify:dependencies
yarn verify:package
yarn verify:consumers
yarn verify:publish-contract
```

三项发布门禁分别验证：

- `verify:package`：审计真实 `npm pack --dry-run --json` 清单，确保 source、lib、native、
  Podspec 和官方 mock 都会发布，同时排除 tests、Pods、build 与 Gradle cache。
- `verify:consumers`：在系统 temp 创建 workspace 外 Yarn consumer，安装真实 tarball 与全部
  peers，分别 bundle package root、`source` condition、`lib/module`，并运行官方 mock Jest
  smoke。
- `verify:publish-contract`：比较最新 tag 与当前发布契约，使用无副作用
  `release-it --release-version` 检查 conventional commits 给出的版本级别。

consumer smoke 成功后自动清理 fixture；失败时会保留 temp 路径和完整子进程输出，便于复现。
不要为通过安装使用 `--force`、`--legacy-peer-deps` 或全局 override。

## Example 与原生验证

启动 Metro 或运行 example：

```sh
yarn example start
yarn example ios
yarn example android
```

JS 修改通常由 Metro 刷新；native 修改需要重新构建 app。原生改动还应运行对应 contract、
unit test、release build、merged manifest、R8、Pod/Codegen 与 XCTest 门禁。缺少 Android
SDK 时如实记录为 CI/有 SDK 环境待验证，不能把静态检查写成 assemble 已通过。

模拟器不能完成真实微信/钉钉拉起与回跳。分享链路改动必须另用有凭据的真机完成矩阵验证。

## 分支、提交与 PR

不要直接修改或推送 `main`。从语义明确的任务分支开始，保留工作区中与当前任务无关的改动。
提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat`：新增能力。
- `fix`：缺陷修复。
- `refactor`：不改变外部行为的重构。
- `docs`：文档变更。
- `test`：测试变更。
- `chore` / `ci`：工具链或 CI 变更。

发 PR 前：

1. 运行与改动范围对应的完整本地门禁。
2. 检查 README、website、llms 与 `skills/umeng-share` 是否需要同步。
3. 确认没有提交 tarball、temp fixture、Pods、build、coverage 或 Gradle cache。
4. 让 required CI 全部通过后再合入 `main`。

## 发布

开发者不得手工修改 package version、创建发布 tag、运行 `yarn release` 或执行
`npm publish`。任务分支经 PR 和 CI 合入 `main` 后，release workflow 会按 conventional
commits 自动计算版本、生成 changelog、发布 npm package 并创建 GitHub Release。

`workflow_dispatch` 只供维护者在明确的应急发布场景使用。
