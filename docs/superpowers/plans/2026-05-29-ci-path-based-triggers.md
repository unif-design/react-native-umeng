# CI 按变更区域精准触发 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `ci.yml` 按"改了哪个区域"精准触发 job —— 纯文档不跑 build、改 Android 不跑 iOS、改 src 才两端 build —— 在不改 ruleset、不卡 PR 的前提下省 CI 时间(纯文档 PR 从 ~20min 降到秒级)。

**Architecture:** 加一个 `changes` job 用 `dorny/paths-filter` 算各区域布尔 outputs;`lint/test/build-library/build-android/build-ios` 各 `needs: changes` + 加 `if:` 条件。被 `if` 跳过的 required check 报 Success(GitHub 官方行为),所以 required 名字不变、ruleset 不动。`actionlint` 总跑。

**Tech Stack:** GitHub Actions、dorny/paths-filter v4.0.1(pin SHA `fbd0ab8f3e69293af611ebaee6363fc25e6d187d`)。

参考 spec:`docs/superpowers/specs/2026-05-29-ci-path-based-triggers-design.md`
关键依据:GitHub《Handling skipped but required checks》—— job 级 `if`-skip = Success(放行);workflow 级 `paths` 过滤 = Pending(卡死,故不用)。

---

### Task 1: 加 `changes` job(dorny/paths-filter)

**Files:**
- Modify: `.github/workflows/ci.yml`(在 `actionlint` job 后、`lint` job 前插入)

- [ ] **Step 1: 插入 changes job**

用 Edit:锚点 old_string 是 actionlint job 结尾到 lint job 开头:
```
        shell: bash

  lint:
```
替换为(注意 dorny README 明确支持 YAML anchor 复用,`code` 用 anchor flatten 出"非纯文档"聚合):
```
        shell: bash

  changes:
    runs-on: ubuntu-latest
    outputs:
      js: ${{ steps.filter.outputs.js }}
      android: ${{ steps.filter.outputs.android }}
      ios: ${{ steps.filter.outputs.ios }}
      shared: ${{ steps.filter.outputs.shared }}
      code: ${{ steps.filter.outputs.code }}
    steps:
      - name: Checkout
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - name: Filter changed paths
        uses: dorny/paths-filter@fbd0ab8f3e69293af611ebaee6363fc25e6d187d # v4.0.1
        id: filter
        with:
          # 各区域 glob;code = 非纯文档聚合(anchor flatten),给 lint/test 用。
          # 注意:不要给本 workflow 加 on.paths —— 那会让 required check 永远 pending 卡死 PR。
          filters: |
            shared: &shared
              - 'package.json'
              - 'yarn.lock'
              - 'tsconfig*.json'
              - 'babel.config.js'
              - 'react-native.config.js'
              - '.nvmrc'
              - '.github/**'
            js: &js
              - 'src/**'
            android: &android
              - 'android/**'
            ios: &ios
              - 'ios/**'
              - '*.podspec'
            code:
              - *shared
              - *js
              - *android
              - *ios

  lint:
```

- [ ] **Step 2: 校验 YAML 合法**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
Expected: `YAML OK`(注:`safe_load` 支持 anchor,能解析通过)。

---

### Task 2: 给 5 个 job 加 `needs: changes` + `if:`

**Files:**
- Modify: `.github/workflows/ci.yml`(lint / test / build-library / build-android / build-ios 各 job 头)

- [ ] **Step 1: lint 加 needs+if**

Edit:old_string
```
  lint:
    runs-on: ubuntu-latest

    steps:
```
new_string
```
  lint:
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.code == 'true'

    steps:
```

- [ ] **Step 2: test 加 needs+if**

Edit:old_string
```
  test:
    runs-on: ubuntu-latest

    steps:
```
new_string
```
  test:
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.code == 'true'

    steps:
```

- [ ] **Step 3: build-library 加 needs+if**

Edit:old_string
```
  build-library:
    runs-on: ubuntu-latest

    steps:
```
new_string
```
  build-library:
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.js == 'true' || needs.changes.outputs.shared == 'true'

    steps:
```

- [ ] **Step 4: build-android 加 needs+if**

Edit:old_string
```
  build-android:
    runs-on: ubuntu-latest

    env:
      TURBO_CACHE_DIR: .turbo/android
```
new_string
```
  build-android:
    runs-on: ubuntu-latest
    needs: changes
    if: needs.changes.outputs.android == 'true' || needs.changes.outputs.js == 'true' || needs.changes.outputs.shared == 'true'

    env:
      TURBO_CACHE_DIR: .turbo/android
```

- [ ] **Step 5: build-ios 加 needs+if**

Edit:old_string
```
  build-ios:
    runs-on: macos-latest

    env:
      XCODE_VERSION: 26
```
new_string
```
  build-ios:
    runs-on: macos-latest
    needs: changes
    if: needs.changes.outputs.ios == 'true' || needs.changes.outputs.js == 'true' || needs.changes.outputs.shared == 'true'

    env:
      XCODE_VERSION: 26
```

- [ ] **Step 6: 校验 YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
Expected: `YAML OK`

---

### Task 3: 本地 actionlint 校验 + 提交 + 推送

**Files:** 无新增

- [ ] **Step 1: 本地跑 actionlint(与 CI 同款校验)**

Run: `actionlint .github/workflows/ci.yml`(若未装:`brew install actionlint`)
Expected: 无输出、退出 0。重点确认 `if:` 表达式、`needs` 引用、dorny `with` 无报错。
(若本机无 brew/actionlint,跳过本步 —— CI 里的 actionlint job 会兜底校验。)

- [ ] **Step 2: 提交**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 按变更区域精准触发(dorny/paths-filter + job 级 if)"
```
(commitlint 要求 subject 小写开头,上面已满足。)

- [ ] **Step 3: 推送**

```bash
git push -u origin ci/path-based-triggers
```

---

### Task 4: 端到端验证矩阵

**说明:** 本 PR 自己改了 `.github/**` → 命中 `shared` → `lint/test/build-*` **全跑**,所以本 PR 先验证"改动没把 CI 改坏"(全绿),但**不演示 skip**。skip 行为要靠一个纯文档测试 PR 验证。

- [ ] **Step 1: 验证本 PR 全绿**

开 PR(标题 conventional,如 `ci: 按变更区域精准触发`)。等 checks。
Expected: `changes` 跑出 `shared=true`;`lint/test/build-library/build-android/build-ios/actionlint` 全部 **运行且通过**(证明改动本身没破坏 CI)。

- [ ] **Step 2: 验证 skip + required 不卡(关键)**

临时开一个**只改 `README.md`** 的测试 PR(可基于 main 改一行)。
Expected:
- `changes` 跑出 `code=false`;
- `lint/test/build-library/build-android/build-ios` 显示 **Skipped**;
- PR 的 merge box 仍 **green / mergeable**(skipped required 视为通过——这是整个方案成立的关键证据);
- 只有 `actionlint`/CodeQL/`pr-agent`/`changes` 实际跑。
验证完关掉该测试 PR(或留作记录)。

- [ ] **Step 3:(可选)验证单端**

临时 PR 只改 `android/` 下某文件的注释。
Expected:`build-android` 跑、`build-ios` **Skipped**、`build-library` Skipped(没动 js/shared)、`lint/test` Skipped(android 不在 code?——注意:android 在 code 聚合里,故 lint/test 会跑)。
> 修正预期:`android` 属于 `code` 聚合 → `lint/test` 会跑;`build-ios` skip、`build-library` skip。验证这个即可。

---

## 验证通过后

合并 PR。合并后**下次任何纯文档 PR 自动省掉 ~20min build**。

> 合并提醒:本 PR 只改 `.github/**`,不在 `release.yml` 的发版 paths(src/ios/android/podspec/package.json/yarn.lock)内 → **不触发发版**,不 bump 版本。

## 范围(YAGNI)

- 只改 `ci.yml`。不动 ruleset、pr-agent、deploy-docs、CodeQL。
- camera/design 本仓验证稳妥后再对齐(design 不碰除非用户发话)。

## 风险与注意

- **绝不给 ci.yml 加 `on.paths`**:会让 required check 永远 pending、卡死所有 PR(与 job 级 `if`-skip 行为相反)。
- `changes` job 万一失败 → 下游 build 因 `needs` 失败而 skip、报 Success(双刃剑)。dorny+checkout 极少失败,且失败会在 PR 显示 red,reviewer 可见。可接受。
- dorny 在 push/缺 base 场景可能把所有标 true → 保守全跑(安全方向)。
