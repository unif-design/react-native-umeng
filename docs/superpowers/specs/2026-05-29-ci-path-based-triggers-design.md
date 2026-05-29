# CI 按变更区域精准触发 — 设计

## Context

`ci.yml` 当前 `on: push/pull_request to main` 无 paths 过滤,任何 PR 都全跑 6 个 job。实测纯文档 PR(#20)也触发了 `build-ios` **19m39s**(macOS runner,最贵)。诉求:按"改了哪个区域"精准触发 —— 改 Android 不跑 iOS、纯文档不跑 build、改文档不跑 deploy 等,省 CI 时间。

**硬约束**:main 的 `protect main` ruleset 把 `lint`、`test`、`build-android`、`build-ios`、`build-library` 设为 **required status checks**。

## 决定性事实(GitHub 官方,已核实)

- **job 级 `if:` 跳过的 required check → 报 `Success`、放行。** 安全。
- **workflow 级 `on.paths` 过滤掉整个 workflow → required check 永远 `Pending`、卡死 merge。** 禁用。
- 官方文档《Handling skipped but required checks》(Troubleshooting required status checks)+《About protected branches》(required 接受 success/skipped/neutral)。
- 副作用:若 job 因 `needs` 的**上游 job 真失败**而 skip,也会报 Success。本设计的 build job 只 `needs: changes`(秒级、几乎不失败),故风险不存在。

## 方案(选定:A)

**一个 `changes` job 用 `dorny/paths-filter` 算各区域布尔 → 各 job 加 `if:` 条件。required checks 名字维持不变,被 `if` 跳过的自动绿,不改 ruleset。**

否决的替代:拆多 workflow 各自 `on.paths`(对 required workflow 会永远 pending、卡死,官方坐实)。备选未采用:加 `all-checks-pass` 聚合 gate job 设为唯一 required(更稳但要改 ruleset + 写 gate 逻辑;changes 失败概率极低,YAGNI)。

## changes job(dorny/paths-filter)

新增于 `ci.yml`,其余 job `needs: changes` 读其 outputs。action pin 到 SHA(本仓库惯例),版本 `dorny/paths-filter` v3.x。

```yaml
  changes:
    runs-on: ubuntu-latest
    outputs:
      js: ${{ steps.filter.outputs.js }}
      android: ${{ steps.filter.outputs.android }}
      ios: ${{ steps.filter.outputs.ios }}
      shared: ${{ steps.filter.outputs.shared }}
      code: ${{ steps.filter.outputs.code }}   # js||android||ios||shared 聚合,给 lint/test
    steps:
      - uses: actions/checkout@<pinned>
      - uses: dorny/paths-filter@<pinned v3.x>
        id: filter
        with:
          filters: |
            shared: &shared
              - 'package.json'
              - 'yarn.lock'
              - 'tsconfig*.json'
              - 'babel.config.js'
              - 'react-native.config.js'
              - '.nvmrc'
              - '.github/**'
            js:
              - 'src/**'
            android:
              - 'android/**'
            ios:
              - 'ios/**'
              - '*.podspec'
            code:
              - *shared
              - 'src/**'
              - 'android/**'
              - 'ios/**'
```

`code` = 非纯文档聚合(YAML anchor 复用 shared)。dorny 在 PR 上用 base branch diff;push/无 base 时保守(倾向全标 true → 多跑而非少跑,安全方向)。

## 触发矩阵(中等粒度)

| job | `if:` 条件 |
|---|---|
| `changes` | 总跑 |
| `actionlint` | 总跑(4s,可忽略) |
| `lint` / `test` | `needs.changes.outputs.code == 'true'` |
| `build-library` | `js \|\| shared` |
| `build-android` | `android \|\| js \|\| shared` |
| `build-ios` | `ios \|\| js \|\| shared` |

(`js`/`shared` 牵连两端 build:`src/NativeUmeng*.ts` 是 codegen 源、改 deps 影响两端,故 src/shared 重 build 双端。)

效果:纯文档 → 仅 changes/actionlint/codeql/pr-agent;只改 `android/` → build-ios skip(省 ~19min);改 `src/` → 两端 build。

## 不改动

- `pr-agent`(非 required、38s、评审文档也有价值)、`deploy-docs`(已有自身 paths,非 required)、CodeQL(GitHub 托管 default setup,无 workflow 文件)。
- ruleset(required 名字不变)。

## 范围

仅 `@unif/react-native-umeng`(先行者)。camera/design 现无此范式,本仓验证稳妥后再对齐(design 不碰除非用户发话)。

## 验证

1. 改一行 `README.md` 开 PR:`build-ios/android/library/lint/test` 显示 **skipped**,PR merge box 仍 **green 可合**(关键:skipped required 不卡)。
2. 改 `android/` 下文件:`build-android` 跑、`build-ios` skip。
3. 改 `ios/` 或 `*.podspec`:`build-ios` 跑、`build-android` skip。
4. 改 `src/`:两端 build 都跑。
5. 改 `package.json`:全 build 跑。
6. `actionlint` 自身校验新 ci.yml(CI 里有这个 job)通过。

## 风险

- `changes` job 万一失败 → 下游 build 因 `needs` 失败而 skip、报 Success(双刃剑)。但 dorny+checkout 极少失败,且失败会在 PR 显示 red,reviewer 可见。可接受。
- dorny 在缺 base 场景全标 true → 保守全跑,安全方向。
