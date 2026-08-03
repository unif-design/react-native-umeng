# react-native-umeng 全仓修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次性修复 `@unif/react-native-umeng` 的隐私初始化、JS 错误契约、ShareSheet 竞态、Android/iOS 原生接入、依赖、文档、CI、发布产物与消费侧 `umeng-share` skill。

**Architecture:** 公共 API 保留 `Common.preInit(config)` → `Common.init()`，但 `preInit` 只在 JS 校验并保存不可变配置，授权后的 `init` 才调用 private native `initialize(config)`。JS、Android 与 iOS 分别维护可观察状态机；ShareSheet 以 `sessionId + hostId + phase` 隔离异步会话；所有第三方 SDK 调用通过窄 adapter 进入，便于验证授权前零调用和 Promise 至多 settle 一次。各平台可并行实施，但最终由同一依赖、consumer、文档、skill 与发布门禁收口。

**Tech Stack:** React Native 0.85.3 New Architecture、React 19、TypeScript 6、Jest 29、Kotlin 2、Objective-C++、XCTest、友盟 Android common 9.9.1/share 7.3.7、友盟 iOS UMCommon 7.5.10/UMShare 6.11.1、`@unif/react-native-design@^0.20.0`、`react-native-reanimated@^4.5.3`、`react-native-worklets@^0.11.3`、Yarn 4.11、Bob、Metro、Docusaurus、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-07-30-full-repository-remediation-design.md`

## Global Constraints

- 所有实施提交落在 `fix/full-repository-remediation`，不得直接提交到 `main`。
- 只用 Yarn；锁文件只能由 `yarn install` 生成，禁止手改 `yarn.lock`。
- 公共方法名保持 `Common.preInit(config)`、`Common.init()`、`Common.isInited()`；private Codegen 接口改成 `initialize(config)`、`isInited()`。
- 用户授权前，模块构造、Analytics、Share、URL/Universal Link 回调均不得调用友盟、微信或钉钉 SDK。
- `ShareResult.code` 对外只允许 `'success'`；取消与失败必须 reject `UmengError`。
- `@unif/react-native-design` 使用 `^0.20.0`，Reanimated 使用 `^4.5.3`，Worklets 使用 `^0.11.3`。
- `react-native-gesture-handler` peer 使用 `>=3.0.0 <4.0.0`；删除 `@gorhom/bottom-sheet`。
- React Native example 的 `react-native-worklets/plugin` 必须位于 Babel plugins 最后。
- Android 本机没有 SDK/JDK；不得声称 Gradle、Robolectric、assemble、merged manifest 或 R8 已通过，必须记录为 CI/有 SDK 环境待验证。
- iOS 本机可用 Xcode 26.5/CocoaPods 1.16.2；Pod 安装需网络时按实际结果报告。
- 微信/钉钉真实拉起与回跳只在带凭据真机验收；编译或 mock 通过不能替代真机闭环。
- `AGENTS.md` 是项目指令唯一真相源；`CLAUDE.md` 只包含 `@AGENTS.md`。
- 每次库变更后检查 `unif-design/skills` 仓的 `skills/umeng-share/`；本轮确定需要更新并单独提交。
- sibling skills 仓已有用户未提交改动；只允许修改和精确暂存 `skills/umeng-share/**`，禁止 `git add -A`、`git add skills` 或顺带提交 marketplace/其他 skill。
- 每个任务遵循 red → green → focused verification → commit；不得用 `|| true`、`exit 0` 或跳过断言掩盖失败。

---

## File Structure

### 新建

```text
src/internal/errors.ts
src/internal/initConfig.ts
src/__tests__/errors.test.ts
src/__tests__/initConfig.test.ts
src/__tests__/public-api.test.ts
src/__tests__/fixtures/deferred.ts
src/__tests__/fixtures/nativeErrors.ts

scripts/verify-dependencies.mjs
scripts/verify-native-contract.mjs
scripts/verify-package.mjs
scripts/verify-consumers.mjs
scripts/verify-agent-instructions.mjs
scripts/verify-publish-contract.mjs

android/src/main/java/com/unif/reactnativeumeng/UmengNativeConfig.kt
android/src/main/java/com/unif/reactnativeumeng/UmengBootstrapAdapter.kt
android/src/main/java/com/unif/reactnativeumeng/UmengCallbackComponents.kt
android/src/main/java/com/unif/reactnativeumeng/UmengAnalyticsAdapter.kt
android/src/main/java/com/unif/reactnativeumeng/UmengShareAdapter.kt
android/src/main/java/com/unif/reactnativeumeng/ShareRequestRegistry.kt
android/src/main/res/xml/react_native_umeng_file_paths.xml
android/src/test/java/com/unif/reactnativeumeng/UmengBootstrapTest.kt
android/src/test/java/com/unif/reactnativeumeng/UmengCallbackComponentsTest.kt
android/src/test/java/com/unif/reactnativeumeng/UmengAnalyticsModuleTest.kt
android/src/test/java/com/unif/reactnativeumeng/UmengShareModuleTest.kt
example/android/app/src/main/java/unif/reactnativeumeng/example/wxapi/WXEntryActivity.kt
example/android/app/src/main/java/unif/reactnativeumeng/example/ddshare/DDShareActivity.kt

ios/UmengSDKAdapters.h
ios/UmengSDKAdapters.mm
ios/UmengBootstrap+Testing.h
ios/UmengShareRequestRegistry.h
ios/UmengShareRequestRegistry.mm
example/ios/ReactNativeUmengExample/ReactNativeUmengExample.entitlements
example/ios/ReactNativeUmengExample/SceneDelegateFixture.swift
example/ios/ReactNativeUmengExampleTests/UmengBootstrapTests.mm
example/ios/ReactNativeUmengExampleTests/UmengAnalyticsTests.mm
example/ios/ReactNativeUmengExampleTests/UmengShareTests.mm
example/ios/ReactNativeUmengExampleTests/TurboModuleRegistrationTests.mm

.github/workflows/project-validation.yml
```

### 重点修改

```text
package.json
example/package.json
website/package.json
yarn.lock
example/babel.config.js
website/src/plugins/docusaurus-rnw/index.js
src/{types,NativeUmengCommon,NativeUmengShare,common,share,analytics,index,mock}.ts
src/ShareSheet/{ShareSheetController,ShareSheetHost}.ts(x)
src/__tests__/*.test.ts(x)
android/{build.gradle,consumer-rules.pro,src/main/AndroidManifest.xml}
android/src/main/java/com/unif/reactnativeumeng/{UmengBootstrap,UmengCommonModule,UmengAnalyticsModule,UmengShareModule}.kt
example/android/{gradle.properties,app/build.gradle,app/src/main/AndroidManifest.xml}
ios/{UmengBootstrap,UmengCommon,UmengAnalytics,UmengShare}.{h,mm}
ReactNativeUmeng.podspec
example/ios/Podfile
example/ios/ReactNativeUmengExample/{AppDelegate.swift,Info.plist}
example/ios/ReactNativeUmengExample.xcodeproj/project.pbxproj
example/ios/ReactNativeUmengExample.xcodeproj/xcshareddata/xcschemes/ReactNativeUmengExample.xcscheme
example/src/App.tsx
turbo.json
.github/workflows/release.yml
README.md
CHANGELOG.md
CONTRIBUTING.md
AGENTS.md
CLAUDE.md
website/scripts/{build-llms.js,build-llms.test.js}
website/src/pages/index.tsx
website/docusaurus.config.ts
website/docs/**/*.md
```

### 删除

```text
website/src/clientModules/rn-globals.ts
```

删除根 `package.json#files` 中不存在的 `react-native.config.js` 条目，不为满足错误清单创建空文件。

### sibling skills 仓

```text
../skills/skills/umeng-share/SKILL.md
../skills/skills/umeng-share/references/native-setup.md
../skills/skills/umeng-share/references/troubleshooting.md
../skills/skills/umeng-share/assets/ShareEntry.tsx
../skills/skills/umeng-share/assets/WXEntryActivity.kt
../skills/skills/umeng-share/assets/DDShareActivity.kt
../skills/skills/umeng-share/scripts/doctor.sh
../skills/skills/umeng-share/scripts/doctor.test.sh
```

## Task Dependency Order

```text
Task 1 dependencies
  ├─ Task 2 shared JS contracts
  │    ├─ Task 3 Common
  │    ├─ Task 4 Share/Analytics/mock
  │    └─ Task 5 Controller ── Task 6 Host
  ├─ Task 7 Android bootstrap ── Task 8 Android modules/example
  └─ Task 9 iOS bootstrap ───── Task 10 iOS modules/example

Tasks 3–10 complete
  └─ Task 11 package/consumer/CI/release
       └─ Task 12 docs/website/llms
            └─ Task 13 AGENTS/CLAUDE
                 └─ Task 14 consumer skill
                      └─ Task 15 final verification
```

Tasks 3、4、5 在 Task 2 后可并行；Task 7 与 Task 9 可并行；Task 8 与 Task 10 分别依赖各自 bootstrap。共享文件 `package.json`、`yarn.lock`、`AGENTS.md`、README/website 与 sibling skill 只由指定任务修改，避免并行冲突。

---

### Task 1: 锁定依赖、workspace 与 Babel 契约

**Files:**
- Create: `scripts/verify-dependencies.mjs`
- Modify: `package.json`
- Modify: `example/package.json`
- Modify: `website/package.json`
- Modify: `example/babel.config.js`
- Modify: `website/src/plugins/docusaurus-rnw/index.js`
- Modify: `yarn.lock`

**Interfaces:**
- Produces: `yarn verify:dependencies`；所有后续 JS/UI/consumer 构建使用同一组依赖。
- Produces: example 显式消费 `"@unif/react-native-umeng": "workspace:*"`。

- [ ] **Step 1: 写依赖契约脚本并先观察失败**

`scripts/verify-dependencies.mjs` 使用 `node:assert/strict` 读取三个 manifest，至少锁定：

```js
const shared = {
  '@unif/react-native-design': '^0.20.0',
  'react-native-reanimated': '^4.5.3',
  'react-native-worklets': '^0.11.3',
};

assert.deepEqual(
  Object.fromEntries(Object.keys(shared).map((name) => [name, root.peerDependencies[name]])),
  shared
);
assert.equal(root.peerDependencies['react-native-gesture-handler'], '>=3.0.0 <4.0.0');
assert.equal(example.dependencies['@unif/react-native-umeng'], 'workspace:*');
assert.equal(example.dependencies['@gorhom/bottom-sheet'], undefined);
assert.equal(website.dependencies['@gorhom/bottom-sheet'], undefined);
```

脚本还要断言根 peer/dev、example dependencies、website dependencies 均显式安装 Design 根 barrel 会静态触达的 peers：

```text
@sbaiahmed1/react-native-blur
react
react-native
react-native-gesture-handler
react-native-reanimated
react-native-reanimated-carousel
react-native-safe-area-context
react-native-svg
react-native-worklets
```

安装后动态加载 `semver`、解析 `node_modules/react-native-reanimated/package.json` 与 `node_modules/react-native-worklets/package.json`，断言锁定实际版本满足 Umeng 声明、Reanimated 的 Worklets peer 和两者的 RN peer。

Run:

```sh
node scripts/verify-dependencies.mjs
```

Expected: FAIL，明确报告当前 Design 0.5.1、Gesture Handler 2.x、缺 Reanimated/Worklets peers、example 缺 workspace 依赖且仍含 Bottom Sheet。

- [ ] **Step 2: 只 patch manifest，不重写模板字段**

在根 `peerDependencies` 使用设计规格的完整范围；根 `devDependencies`、example、website 安装兼容测试版本。加入 `semver@^7.7.2` 供验证脚本使用；删除 Bottom Sheet。`package.json#files` 删除不存在的 `react-native.config.js`。

根 scripts 增加：

```json
"verify:dependencies": "node scripts/verify-dependencies.mjs"
```

example Babel 配置保持 Bob 现有结构，只新增最后一个 plugin：

```js
module.exports = getConfig(
  {
    presets: ['module:@react-native/babel-preset'],
    plugins: ['react-native-worklets/plugin'],
  },
  { root, pkg }
);
```

website 的自定义转换链删除 Bottom Sheet 专用匹配/注释，保留并确保 Worklets plugin 位于实际 plugin 数组最后。

- [ ] **Step 3: 生成锁文件并检查安装诊断**

Run:

```sh
yarn install
yarn why @unif/react-native-design
yarn why react-native-reanimated
yarn why react-native-worklets
yarn explain peer-requirements
```

Expected: 安装成功；三个 workspace 解析到兼容组合；没有由本仓缺失声明造成的 peer warning。

- [ ] **Step 4: 运行依赖契约与 immutable 复验**

Run:

```sh
node scripts/verify-dependencies.mjs
yarn install --immutable
yarn typecheck
yarn test --maxWorkers=2
```

Expected: 四条命令均退出 0。

- [ ] **Step 5: 提交**

```sh
git add package.json example/package.json website/package.json example/babel.config.js website/src/plugins/docusaurus-rnw/index.js yarn.lock scripts/verify-dependencies.mjs
git commit -m "chore: align runtime dependency contract"
```

---

### Task 2: 建立共享错误归一化与初始化配置校验

**Files:**
- Create: `src/internal/errors.ts`
- Create: `src/internal/initConfig.ts`
- Create: `src/__tests__/errors.test.ts`
- Create: `src/__tests__/initConfig.test.ts`
- Create: `src/__tests__/fixtures/nativeErrors.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Produces:

```ts
normalizeError(
  error: unknown,
  fallbackCode: ErrorCode,
  fallbackMessage: string
): UmengError;

normalizeInitConfig(
  config: unknown,
  os: 'android' | 'ios'
): Readonly<NormalizedUmengInitConfig>;

areInitConfigsEqual(
  left: NormalizedUmengInitConfig,
  right: NormalizedUmengInitConfig
): boolean;

toNativeInitConfig(config: NormalizedUmengInitConfig): object;
```

- Consumed by: Tasks 3、4。

- [ ] **Step 1: 为错误归一化写失败测试**

覆盖以下固定矩阵：

```ts
expect(normalizeError(new UmengError('E_USER_CANCEL', 'x'), 'E_UNKNOWN', 'fallback'))
  .toBe(original);
expect(normalizeError(Object.assign(new Error('missing init'), {
  code: 'E_NOT_INITIALIZED',
}), 'E_SHARE_FAILED', 'share failed')).toMatchObject({
  code: 'E_NOT_INITIALIZED',
  message: 'missing init',
});
expect(normalizeError({ code: 'VENDOR_42', message: '' }, 'E_UNKNOWN', 'fallback'))
  .toMatchObject({ code: 'E_UNKNOWN', message: 'fallback' });
```

同时断言 `nativeError` 保存原对象，只有 `ErrorCode` 白名单能穿透。

Run:

```sh
yarn test src/__tests__/errors.test.ts --runInBand
```

Expected: FAIL，模块不存在。

- [ ] **Step 2: 实现 `normalizeError`**

`src/internal/errors.ts` 使用固定白名单，不解析 message 猜 code：

```ts
const ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  'E_PLATFORM_NOT_INSTALLED',
  'E_PLATFORM_NOT_SUPPORTED',
  'E_INVALID_OPTIONS',
  'E_USER_CANCEL',
  'E_SHARE_FAILED',
  'E_NOT_INITIALIZED',
  'E_UNKNOWN',
]);
```

未知/空 code 用调用点 fallback；空 message 用固定 fallback；`UmengError` 原样返回。

- [ ] **Step 3: 为配置规范化写失败测试**

测试必须逐项覆盖：

- 字符串 trim 后缓存，空白字符串非法。
- `null`、数组、非对象、非字符串字段非法。
- Android 微信要求 `wechatAppId + wechatAppSecret`。
- iOS 微信要求 `wechatAppId + wechatAppSecret + HTTPS wechatUniversalLink`。
- Universal Link 必须是绝对 HTTPS 且有 host。
- 任一微信字段单独出现都原子失败，不写部分结果。
- 固定字段比较不受 key 顺序影响。
- `toNativeInitConfig` 不发送值为 `undefined` 的 key。

Run:

```sh
yarn test src/__tests__/initConfig.test.ts --runInBand
```

Expected: FAIL，模块不存在。

- [ ] **Step 4: 实现不可变配置**

`NormalizedUmengInitConfig` 固定字段为：

```ts
interface NormalizedUmengInitConfig {
  readonly appkey: string;
  readonly channel: string | undefined;
  readonly wechatAppId: string | undefined;
  readonly wechatAppSecret: string | undefined;
  readonly wechatUniversalLink: string | undefined;
  readonly dingtalkAppId: string | undefined;
}
```

返回 `Object.freeze` 快照；相等性按上述顺序逐字段比较，禁止 `JSON.stringify` 或对象引用比较。

- [ ] **Step 5: 修正文档类型并运行 focused tests**

修正 `UmengInitConfig` JSDoc 为 `preInit` JS-only。本任务暂不收窄 `ShareCode`，避免旧 share/mock 在 Task 4 迁移前让独立提交处于 typecheck 失败状态。

Run:

```sh
yarn test src/__tests__/errors.test.ts src/__tests__/initConfig.test.ts src/__tests__/types.test.ts --runInBand
yarn typecheck
```

Expected: PASS。

- [ ] **Step 6: 提交**

```sh
git add src/internal src/__tests__/errors.test.ts src/__tests__/initConfig.test.ts src/__tests__/fixtures/nativeErrors.ts src/types.ts src/__tests__/types.test.ts
git commit -m "feat: normalize errors and init config"
```

---

### Task 3: 把 `Common.preInit` 收敛为 JS-only 状态机

**Files:**
- Modify: `src/NativeUmengCommon.ts`
- Modify: `src/common.ts`
- Modify: `src/__tests__/common.test.ts`
- Create: `src/__tests__/public-api.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Native Codegen:

```ts
initialize(config: Object): Promise<void>;
isInited(): Promise<boolean>;
```

- Public API remains:

```ts
preInit(config: UmengInitConfig): Promise<void>;
init(): Promise<void>;
isInited(): Promise<boolean>;
```

- Private native rejection may carry `restartRequired: true`; JS preserves it only in `UmengError.nativeError` and never parses message text.

- [ ] **Step 1: 改写 Common 测试并确认旧实现失败**

用 `jest.resetModules()`/`jest.isolateModulesAsync()` 隔离模块状态，不再调用公共 `__resetForTests`。锁定：

```ts
await Common.preInit(CONFIG);
expect(NativeUmengCommon.initialize).not.toHaveBeenCalled();

const first = Common.init();
const second = Common.init();
expect(first).toBe(second);
expect(NativeUmengCommon.initialize).toHaveBeenCalledTimes(1);
expect(NativeUmengCommon.initialize).toHaveBeenCalledWith(NORMALIZED_CONFIG);
```

还需覆盖：未 preInit 的 init → `E_NOT_INITIALIZED`；init 开始前新配置替换；相同配置幂等；init 开始后不同配置 → `E_INVALID_OPTIONS`；native Error 归一化；失败清 in-flight 后同配置可再次进入 native；成功后不重复调用。

`isInited` 另测 native rejection 归一化为 `E_UNKNOWN`，以及非 boolean resolve 值 reject `E_UNKNOWN`，不能把异常 bridge 值当真。

Run:

```sh
yarn test src/__tests__/common.test.ts --runInBand
```

Expected: FAIL，因为旧实现仍在 preInit 调 native 且 bridge 方法名不符。

- [ ] **Step 2: 修改 Codegen spec 与 Common 状态机**

`src/common.ts` 只持有：

```ts
let configSnapshot: Readonly<NormalizedUmengInitConfig> | null = null;
let nativeStarted = false;
let initialized = false;
let initPromise: Promise<void> | null = null;
```

`preInit` 完整规范化后才原子写入；`init` 在调用 native 前设置 `nativeStarted=true`，并发调用复用同一 Promise。native 失败只清 `initPromise`；不清配置和 `nativeStarted`，避免发生过 native 副作用后换 appkey。

`isInited` 用 `normalizeError(..., 'E_UNKNOWN', 'Failed to query Umeng initialization state')` 包裹 bridge，并运行时验证返回值确为 boolean。

- [ ] **Step 3: 改普通 ESM 根入口并锁定公共导出**

`src/index.ts` 使用：

```ts
import * as Common from './common';
import * as Share from './share';
import * as Analytics from './analytics';

export { Common, Share, Analytics };
```

`public-api.test.ts` 断言 `Common` 不含 `__resetForTests`，三个 namespace 与类型/Host 仍可导入。

- [ ] **Step 4: 运行测试、类型与 Bob**

```sh
yarn test src/__tests__/common.test.ts src/__tests__/public-api.test.ts --runInBand
yarn typecheck
yarn prepare
```

Expected: 全部 PASS；生成的 `lib/module/index.js` 不含 `export * as`。

- [ ] **Step 5: 提交**

```sh
git add src/NativeUmengCommon.ts src/common.ts src/index.ts src/__tests__/common.test.ts src/__tests__/public-api.test.ts lib
git commit -m "feat: enforce js-only pre-initialization"
```

若 `lib/` 被 gitignore，不得强行 add；以 `git status --ignored` 确认后只提交源码。

---

### Task 4: 统一 Share、Analytics、native result 与 mock 契约

**Files:**
- Modify: `src/NativeUmengShare.ts`
- Modify: `src/types.ts`
- Modify: `src/share.ts`
- Modify: `src/analytics.ts`
- Modify: `src/mock.ts`
- Modify: `src/__tests__/share.test.ts`
- Modify: `src/__tests__/analytics.test.ts`
- Modify: `src/__tests__/mock.test.ts`
- Modify: `src/__tests__/types.test.ts`

**Interfaces:**
- Private `NativeShareCode = 'success' | 'cancel' | 'failed'`。
- Public `ShareCode = 'success'` 与 `ShareResult.code: 'success'`。
- Public Share Promise 只 resolve `{ code: 'success', platform, message? }`。
- `shareCancel(platform)`/`shareFailed(platform, message?)` 返回 `UmengError`，用于 `mockRejectedValueOnce`。

- [ ] **Step 1: 为 share result 与参数矩阵写失败测试**

新增表驱动测试：

```ts
it.each([
  [null, 'E_UNKNOWN'],
  [{}, 'E_UNKNOWN'],
  [{ code: 'mystery', platform: 'wechat_session' }, 'E_UNKNOWN'],
  [{ code: 'success', platform: 'dingtalk' }, 'E_UNKNOWN'],
])('rejects malformed native result %#', async (nativeResult, code) => {
  mockedShareText.mockResolvedValueOnce(nativeResult);
  await expect(Share.shareText({
    platform: Platform.WECHAT_SESSION,
    text: 'hi',
  })).rejects.toMatchObject({ code });
});
```

覆盖 RN 风格普通 Error 的合法/未知 code；URL 仅接受绝对 http/https；options/payload 必须是对象；必填字符串 trim 后非空；未知平台；`listPlatforms` 传播错误。

Run:

```sh
yarn test src/__tests__/share.test.ts --runInBand
```

Expected: FAIL，旧实现把 malformed success 当成功或抛原始 TypeError。

- [ ] **Step 2: 实现共享 runtime validation**

`share.ts` 在读取属性前验证对象；每个 Promise 调用用 `try/catch` + `normalizeError`。固定 fallback：

```text
shareText/shareImage/shareLink -> E_SHARE_FAILED
isInstalled/listPlatforms      -> E_UNKNOWN
```

native resolve 值逐字段验证，请求平台与响应平台不一致必须 `E_UNKNOWN`。cancel → `E_USER_CANCEL`，failed → `E_SHARE_FAILED`。

同一步把 `src/types.ts` 的公共 `ShareCode` 收窄为 `'success'`；private native cancel/failed 只能留在 `NativeUmengShare.ts`，不得再泄漏到公共 `ShareResult`。

- [ ] **Step 3: 为 Analytics 同步校验写失败测试**

覆盖空 eventId/userId/provider、数组/`null` params、非 string/number、`NaN`、`Infinity`，断言同步抛：

```ts
expect(() => Analytics.onEvent('purchase', { amount: Number.NaN }))
  .toThrow(expect.objectContaining({ code: 'E_INVALID_OPTIONS' }));
expect(NativeUmengAnalytics.onEvent).not.toHaveBeenCalled();
```

- [ ] **Step 4: 实现 Analytics 校验并同步 mock**

Analytics 保持同步 `void`。`mock.ts` 删除 `Common.__resetForTests`，并改为：

```ts
export const shareCancel = (platform: Platform): UmengError =>
  new UmengError('E_USER_CANCEL', 'User cancelled', { platform });

export const shareFailed = (
  platform: Platform,
  message = 'mock failed'
): UmengError => new UmengError('E_SHARE_FAILED', message, { platform });
```

测试用 `mockRejectedValueOnce(shareCancel(...))`，不得再 resolve cancel/failed。

- [ ] **Step 5: 运行 focused/full JS checks**

```sh
yarn test src/__tests__/share.test.ts src/__tests__/analytics.test.ts src/__tests__/mock.test.ts --runInBand
yarn typecheck
yarn lint
```

Expected: PASS，无 `as ShareResult` 绕过 malformed result。

- [ ] **Step 6: 提交**

```sh
git add src/NativeUmengShare.ts src/types.ts src/share.ts src/analytics.ts src/mock.ts src/__tests__/share.test.ts src/__tests__/analytics.test.ts src/__tests__/mock.test.ts src/__tests__/types.test.ts
git commit -m "fix: enforce public error contract"
```

---

### Task 5: 用 session/host 状态机重构 ShareSheet Controller

**Files:**
- Modify: `src/ShareSheet/ShareSheetController.ts`
- Modify: `src/__tests__/ShareSheetController.test.ts`
- Create: `src/__tests__/fixtures/deferred.ts`

**Interfaces:**

```ts
type SessionPhase = 'loadingPlatforms' | 'ready' | 'sharing';

registerHost(listener: ControllerListener): {
  hostId: number;
  unregister(): void;
};
show(payload: ShareSheetPayload, options?: ShareSheetOptions): Promise<ShareResult>;
markReady(sessionId: number): boolean;
beginSharing(sessionId: number): boolean;
settle(sessionId: number, result: ShareResult): void;
settleError(sessionId: number, error: UmengError): void;
dismiss(sessionId: number, reason?: 'cancel'): void;
```

事件：

```ts
{ kind: 'show'; sessionId: number; payload: ShareSheetPayload; options: ShareSheetOptions }
{ kind: 'dismiss'; sessionId: number }
```

固定 message：

```text
No <ShareSheetHost /> mounted. Mount it once at app root.
Another ShareSheet is already open. Dismiss the previous one first.
The active <ShareSheetHost /> unmounted before the share completed.
```

- [ ] **Step 1: 写 Controller 竞态失败测试**

覆盖：

- 最早注册 Host 是 owner，standby 不收 show。
- owner 卸载立即 reject；非 owner 卸载不影响。
- A settle 后 B 打开，A 的迟到 settle/settleError/dismiss 不影响 B。
- 同 session 只能 settle 一次。
- `beginSharing` 同步 CAS，连续调用只有第一次为 true。
- sharing 后 `dismiss` 不再取消。
- loading/ready 可取消。
- busy/无 Host 使用固定 message。

Run:

```sh
yarn test src/__tests__/ShareSheetController.test.ts --runInBand
```

Expected: FAIL，旧 Controller 无 ID、owner 与 phase。

- [ ] **Step 2: 实现 host registry 与 active session**

使用 `Map<number, Listener>` 保留注册顺序；`show` 选择第一个 entry。`ActiveSession` 同时持有 `sessionId`、`ownerHostId`、phase、resolve/reject。所有 mutator 首先比较 sessionId；不匹配立即返回。

- [ ] **Step 3: 实现 unregister 与幂等 settle**

`unregister` 先从 Map 删除，再仅在 active owner 匹配时用 `E_UNKNOWN` 和固定 owner-unmount message 结束。settle 时先清 active，再通知原 owner dismiss，避免 listener 重入重复结束。

- [ ] **Step 4: 运行测试与类型检查**

```sh
yarn test src/__tests__/ShareSheetController.test.ts --runInBand
yarn typecheck
```

Expected: PASS；Jest 无 unhandled rejection。

- [ ] **Step 5: 提交**

```sh
git add src/ShareSheet/ShareSheetController.ts src/__tests__/ShareSheetController.test.ts src/__tests__/fixtures/deferred.ts
git commit -m "fix: isolate share sheet sessions"
```

---

### Task 6: 让 ShareSheet Host 正确处理 Modal、迟到结果与卸载

**Files:**
- Modify: `src/ShareSheet/ShareSheetHost.tsx`
- Modify: `src/__tests__/ShareSheetHost.test.tsx`

**Interfaces:**
- Consumes: Task 5 的 `registerHost`、session mutators。
- Produces: 每个 Host 只呈现自己的 owner session；Modal 内容内含 `GestureHandlerRootView`。

- [ ] **Step 1: 写 Host 异步失败测试**

使用 deferred fixture 覆盖：

- `listPlatforms` reject 立即结束 Promise，不显示“全部未安装”。
- A 的平台查询晚于 B 返回时，不更新 B。
- 平台双击只调用一次 share。
- 点击后同步进入 sharing、Modal 关闭；back/cancel/backdrop 不能再取消。
- native share 迟到结果携带 A ID，不结束 B。
- Host unmount 结束 pending。
- 多 Host 只显示 owner。
- `hideUninstalled=false` 的未安装 Cell 可点击并 reject `E_PLATFORM_NOT_INSTALLED`，没有 disabled accessibility state。
- `hideUninstalled=true` 不渲染。
- Modal 内可以查询到 `GestureHandlerRootView`。

Run:

```sh
yarn test src/__tests__/ShareSheetHost.test.tsx --runInBand
```

Expected: FAIL，旧 Host 会吞查询错误、禁用未安装平台且无 session guard。

- [ ] **Step 2: 把 Host state 改成 session-aware**

状态至少包含：

```ts
interface SheetState {
  sessionId: number | null;
  phase: 'closed' | 'loadingPlatforms' | 'ready' | 'sharing';
  payload: ShareSheetPayload | null;
  options: ShareSheetOptions;
  platforms: PlatformInfo[];
}
```

每个 async closure 捕获 `sessionId`；更新 state 与 Controller 前都验证 ID。查询成功后先 `markReady`，失败用 `normalizeError(error, 'E_UNKNOWN', 'Failed to query installed share platforms')`。

- [ ] **Step 3: 修 Modal 与平台交互**

结构固定为：

```tsx
<Modal visible={phase === 'ready'} ...>
  <GestureHandlerRootView style={styles.root}>
    <Pressable style={styles.backdrop} ...>
      {/* sheet */}
    </Pressable>
  </GestureHandlerRootView>
</Modal>
```

平台 press 首行调用 `beginSharing(sessionId)`；返回 false 立即退出。未安装平台不调用 native，直接 `settleError(sessionId, E_PLATFORM_NOT_INSTALLED)`；已安装平台再调用 `Share.share*`。

- [ ] **Step 4: 清理 effect 与测试警告**

effect cleanup 调 `unregister()`；每个测试显式 await 对应 Promise，spy `console.error` 并断言没有 `act()`/unhandled rejection。

- [ ] **Step 5: 运行 UI/full JS checks**

```sh
yarn test src/__tests__/ShareSheetHost.test.tsx src/__tests__/ShareSheetController.test.ts --runInBand
yarn test --maxWorkers=2
yarn typecheck
yarn lint
```

Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```sh
git add src/ShareSheet/ShareSheetHost.tsx src/__tests__/ShareSheetHost.test.tsx
git commit -m "fix: harden share sheet lifecycle"
```

---

### Task 7: 重建 Android 授权后 bootstrap、配置与 Manifest

**Files:**
- Create: `scripts/verify-native-contract.mjs`
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengNativeConfig.kt`
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengBootstrapAdapter.kt`
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengCallbackComponents.kt`
- Create: `android/src/main/res/xml/react_native_umeng_file_paths.xml`
- Create: `android/src/test/java/com/unif/reactnativeumeng/UmengBootstrapTest.kt`
- Create: `android/src/test/java/com/unif/reactnativeumeng/UmengCallbackComponentsTest.kt`
- Modify: `android/src/main/java/com/unif/reactnativeumeng/UmengBootstrap.kt`
- Modify: `android/src/main/java/com/unif/reactnativeumeng/UmengCommonModule.kt`
- Modify: `android/src/main/AndroidManifest.xml`
- Modify: `android/build.gradle`

**Interfaces:**

```kotlin
data class UmengNativeConfig(
  val appkey: String,
  val channel: String?,
  val wechatAppId: String?,
  val wechatAppSecret: String?,
  val wechatUniversalLink: String?,
  val dingtalkAppId: String?,
)

fun initialize(context: Context, config: UmengNativeConfig)
fun isInited(): Boolean
```

阶段：`NOT_STARTED`、`PRE_INITIALIZED`、`PLATFORMS_CONFIGURED`、`INITIALIZED`、`INDETERMINATE_FAILURE`。

- [ ] **Step 1: 写可在无 Android SDK 本机运行的静态契约测试**

`verify-native-contract.mjs` 读取源码文本并断言：

- `NativeUmengCommon.ts`/Android/iOS bridge 只有 `initialize`，没有 native `preInit`/`init`。
- Android Manifest 有 FileProvider、两回调 Activity 默认 disabled。
- path XML 只含 `external-files-path umeng_cache/`。
- consumer rules 含精确钉钉包。
- Codegen 有三个 iOS modulesProvider。
- Pod tag 使用 `v#{s.version}`。

Run:

```sh
node scripts/verify-native-contract.mjs
```

Expected: FAIL，列出当前 Android/iOS 缺口。

- [ ] **Step 2: 先写 bootstrap recorder tests**

测试 fake adapter 的精确顺序：

```text
preInit -> setWeixin? -> setDing? -> setFileProvider -> init -> enableCallbacks
```

覆盖构造零调用、同配置幂等、不同配置拒绝、已完成阶段不重复、平台注册前异常、vendor 调用后不确定异常进入 terminal、只在全部成功后启用配置的平台。

Android 本机无法执行 Gradle；测试文件仍必须先于实现提交到工作树。CI 命令：

```sh
./example/android/gradlew -p example/android :react-native-umeng:testDebugUnitTest
```

Expected in CI before implementation: FAIL。Expected locally: 记录 “Android SDK/JDK 缺失，未执行”，不得写 PASS。

- [ ] **Step 3: 实现 config、adapter 与阶段机**

`UmengBootstrapAdapter` 不泄露 vendor 类型，production adapter 才 import `UMConfigure`/`PlatformConfig`。每个第三方调用返回后提交阶段；捕获无法判断副作用的 Throwable 后存 terminal error，后续稳定抛带 `restartRequired=true` 的异常。

`UmengCommonModule.initialize(config, promise)` 先防御性解析完整配置，再调用 bootstrap；非法输入 reject `E_INVALID_OPTIONS`，terminal reject `E_UNKNOWN` 并附 private `restartRequired` metadata。

- [ ] **Step 4: 实现 callback component controller**

仅成功 initialized 后启用：

```text
${packageName}.wxapi.WXEntryActivity
${packageName}.ddshare.DDShareActivity
```

只启用已配置平台；初始化失败不启用。使用 `PackageManager.DONT_KILL_APP`。文档撤回同意流程会调用同一 helper 禁用并要求重启。

- [ ] **Step 5: 加 FileProvider、disabled callbacks 与 AndroidX Core**

Manifest provider authority 为 `${applicationId}.fileprovider`；回调 Activity 使用 `${applicationId}.wxapi.WXEntryActivity` / `${applicationId}.ddshare.DDShareActivity` 且 `android:enabled="false"`。path XML 只开放：

```xml
<external-files-path name="umeng_cache" path="umeng_cache/" />
```

`android/build.gradle` 显式加 AndroidX Core 与 JUnit 测试依赖。

- [ ] **Step 6: 运行本机静态验证**

```sh
node scripts/verify-native-contract.mjs
xmllint --noout android/src/main/AndroidManifest.xml
xmllint --noout android/src/main/res/xml/react_native_umeng_file_paths.xml
```

Expected: Android 静态部分 PASS；iOS 相关断言仍可在 Task 9 前保持明确失败，因此脚本支持 `--platform android` 聚焦运行。

- [ ] **Step 7: 提交**

```sh
git add scripts/verify-native-contract.mjs android/src/main android/src/test android/build.gradle
git commit -m "fix(android): gate vendor initialization"
```

---

### Task 8: 加固 Android Share/Analytics、回调 Activity 与 R8

**Files:**
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengAnalyticsAdapter.kt`
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengShareAdapter.kt`
- Create: `android/src/main/java/com/unif/reactnativeumeng/ShareRequestRegistry.kt`
- Create: `android/src/test/java/com/unif/reactnativeumeng/UmengAnalyticsModuleTest.kt`
- Create: `android/src/test/java/com/unif/reactnativeumeng/UmengShareModuleTest.kt`
- Modify: `android/src/main/java/com/unif/reactnativeumeng/UmengAnalyticsModule.kt`
- Modify: `android/src/main/java/com/unif/reactnativeumeng/UmengShareModule.kt`
- Modify: `android/consumer-rules.pro`
- Create: `example/android/app/src/main/java/unif/reactnativeumeng/example/wxapi/WXEntryActivity.kt`
- Create: `example/android/app/src/main/java/unif/reactnativeumeng/example/ddshare/DDShareActivity.kt`
- Modify: `example/android/gradle.properties`
- Modify: `example/android/app/build.gradle`
- Modify: `example/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- `ShareRequestRegistry` 为每个请求创建 `AtomicBoolean` settle guard，并能在 `invalidate`/host destroy 时 reject 全部 active request。
- 所有 Share/Analytics gate 发生在取得 production adapter 或 vendor manager 之前。

- [ ] **Step 1: 写 Analytics 与 Share recorder tests**

锁定：

- init 前 `onEvent/signIn/signOut` recorder 调用数为 0。
- init 后准确转发。
- init 前 `share*`/`isInstalled` reject `E_NOT_INITIALIZED`，且 recorder 为 0。
- Handler `post=false`、Runnable 同步异常、SDK callback、host destroy 只能首个 settle。
- cancel → `E_USER_CANCEL`；failed → `E_SHARE_FAILED`；destroy → `E_SHARE_FAILED`。
- 迟到 callback 被忽略。
- init 前 `onActivityResult`/destroy 不取得 `UMShareAPI`。

CI red command：

```sh
./example/android/gradlew -p example/android :react-native-umeng:testDebugUnitTest
```

- [ ] **Step 2: 实现 adapters、门禁与 registry**

`runOnUi` 接受 request guard；在真正 Runnable 内 `try/catch`，检查 `Handler.post` boolean。`invalidate` 和 `onHostDestroy` 先 reject registry，再仅在 initialized 时 release vendor manager。

- [ ] **Step 3: 修正 R8**

删除错误的宽泛钉钉规则，加入：

```proguard
-keep class com.android.dingtalk.share.ddsharemodule.** { *; }
-keepattributes Signature
```

保留有证据的友盟/微信规则。

- [ ] **Step 4: 增加宿主可编译 callbacks**

```kotlin
package unif.reactnativeumeng.example.wxapi
import com.umeng.socialize.weixin.view.WXCallbackActivity
class WXEntryActivity : WXCallbackActivity()
```

```kotlin
package unif.reactnativeumeng.example.ddshare
import com.umeng.socialize.media.DingCallBack
class DDShareActivity : DingCallBack()
```

example app 显式声明回调源码需要的 share-wx、微信 OpenSDK、share-dingding 与钉钉 SDK compile dependencies；版本与 library 对齐。

- [ ] **Step 5: 启用 Jetifier 与 release minify 验证入口**

`example/android/gradle.properties` 加 `android.enableJetifier=true`。example release 开 `minifyEnabled true`，build script 增加明确的 `assembleRelease` 入口，不能继续用默认 Debug 冒充。

- [ ] **Step 6: 运行本地静态验证并记录 Android 外部门禁**

```sh
node scripts/verify-native-contract.mjs --platform android
git diff --check -- android example/android
```

Expected: PASS。Gradle/JVM/R8/merged manifest 保持 “待 CI/有 SDK 环境验证”。

CI/有 SDK 环境必须运行：

```sh
./example/android/gradlew -p example/android testDebugUnitTest
./example/android/gradlew -p example/android :app:processReleaseMainManifest :app:assembleRelease
```

并断言 merged manifest authority/path、callbacks 默认 disabled、minify 成功。

- [ ] **Step 7: 提交**

```sh
git add android example/android
git commit -m "fix(android): harden share lifecycle"
```

---

### Task 9: 重建 iOS bootstrap、adapter、Pod module 与 XCTest

**Files:**
- Create: `ios/UmengSDKAdapters.h`
- Create: `ios/UmengSDKAdapters.mm`
- Create: `ios/UmengBootstrap+Testing.h`
- Modify: `ios/UmengBootstrap.h`
- Modify: `ios/UmengBootstrap.mm`
- Modify: `ios/UmengCommon.mm`
- Modify: `ReactNativeUmeng.podspec`
- Modify: `package.json`
- Modify: `example/ios/Podfile`
- Create: `example/ios/ReactNativeUmengExampleTests/UmengBootstrapTests.mm`
- Create: `example/ios/ReactNativeUmengExampleTests/TurboModuleRegistrationTests.mm`
- Modify: `example/ios/ReactNativeUmengExample.xcodeproj/project.pbxproj`
- Modify: `example/ios/ReactNativeUmengExample.xcodeproj/xcshareddata/xcschemes/ReactNativeUmengExample.xcscheme`

**Interfaces:**

```objc
- (void)initialize:(NSDictionary *)config
         completion:(void (^)(NSError *_Nullable error))completion;
- (BOOL)isInited;
- (BOOL)handleOpenURL:(NSURL *)url
              options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options;
- (BOOL)handleUniversalLink:(NSUserActivity *)userActivity;
```

adapter 顺序：Universal Link → WeChat `setPlaform` BOOL → DingTalk `setPlaform` BOOL → `UMConfigure initWithAppkey`。

- [ ] **Step 1: 写 fake adapter XCTest**

`UmengBootstrapTests.mm` 覆盖：

- singleton/module 构造与 callback handler 在 init 前零 vendor 调用。
- 所有 vendor API 在 main thread。
- 精确调用顺序。
- 同配置幂等、不同配置拒绝。
- 微信 BOOL=false 不进入 init；已成功平台重试时不重复。
- vendor exception 进入 terminal，后续返回 `restartRequired`。
- init 前 URL/UL handler 返回 NO。

现有 scheme 指向不存在的 Tests target；先运行静态契约：

```sh
node scripts/verify-native-contract.mjs --platform ios
```

Expected: FAIL，明确报告 bootstrap 旧方法、Pod/Codegen 缺口和悬空 Tests target。

- [ ] **Step 2: 实现窄 adapter 与无死锁状态机**

状态读写放 private serial queue；不得持有 `NSLock` 时 `dispatch_sync` main。并发 initialize 把 completion 加入 waiter 数组；首个请求在主线程执行 vendor 阶段，回到 state queue 提交阶段并统一完成 waiters。

所有 config 在首次 vendor 调用前完整校验；Universal Link 必须先写 `UMSocialGlobal` 再注册微信。

- [ ] **Step 3: 修改 Common bridge**

`UmengCommon.mm` 实现 Codegen `initialize:resolve:reject:`；private `restartRequired` 放入 NSError `userInfo`。`isInited` 保持 Promise。

- [ ] **Step 4: 修 Pod/Codegen contract**

Podspec 加：

```ruby
s.module_name = "ReactNativeUmeng"
s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
s.source = { :git => "...", :tag => "v#{s.version}" }
```

保留 public `UmengBootstrap.h`，同时保留 `UmengCommon.h`、`UmengAnalytics.h`、`UmengShare.h` 为 private headers；新增 adapter/testing headers 不得暴露进 public umbrella。

`package.json#codegenConfig` 加：

```json
"ios": {
  "modulesProvider": {
    "UmengCommon": "UmengCommon",
    "UmengAnalytics": "UmengAnalytics",
    "UmengShare": "UmengShare"
  }
}
```

- [ ] **Step 5: 创建真实 Tests target**

在 pbxproj 创建 `ReactNativeUmengExampleTests` unit-test bundle，依赖 app target；Debug/Release 的 header search path 包含根 `ios/`。Podfile 加：

```ruby
target 'ReactNativeUmengExampleTests' do
  inherit! :complete
end
```

scheme TestAction 指向真实 target。`TurboModuleRegistrationTests.mm` 直接调用运行时 provider，而不只查类名：

```objc
#import <XCTest/XCTest.h>
#import "RCTModuleProviders.h"

@interface TurboModuleRegistrationTests : XCTestCase
@end

@implementation TurboModuleRegistrationTests
- (void)testGeneratedProvidersResolveAllUmengModules {
  NSDictionary *providers = [RCTModuleProviders moduleProviders];
  XCTAssertNotNil(providers[@"UmengCommon"]);
  XCTAssertNotNil(providers[@"UmengAnalytics"]);
  XCTAssertNotNil(providers[@"UmengShare"]);
  XCTAssertTrue([providers[@"UmengCommon"] respondsToSelector:@selector(getTurboModule:)]);
}
@end
```

CI 同时 grep Codegen 生成 provider 的三个精确映射，覆盖生成内容与 runtime lookup 两层。

- [ ] **Step 6: 安装 Pods 并执行 XCTest**

```sh
cd example
bundle install
bundle exec pod install --project-directory=ios
cd ..
xcodebuild test -workspace example/ios/ReactNativeUmengExample.xcworkspace -scheme ReactNativeUmengExample -destination 'platform=iOS Simulator,name=iPhone 17'
```

Expected: Bootstrap 与 registration tests PASS。若 Pod 网络不可用，记录实际网络阻塞，不得声称 PASS。

- [ ] **Step 7: 运行静态契约并提交**

```sh
node scripts/verify-native-contract.mjs --platform ios
git diff --check -- ios example/ios ReactNativeUmeng.podspec package.json
```

```sh
git add ios ReactNativeUmeng.podspec package.json example/ios
git commit -m "fix(ios): gate vendor initialization"
```

---

### Task 10: 加固 iOS Share/Analytics 与宿主回调

**Files:**
- Create: `ios/UmengShareRequestRegistry.h`
- Create: `ios/UmengShareRequestRegistry.mm`
- Modify: `ios/UmengSDKAdapters.h`
- Modify: `ios/UmengSDKAdapters.mm`
- Modify: `ios/UmengAnalytics.mm`
- Modify: `ios/UmengShare.mm`
- Create: `example/ios/ReactNativeUmengExampleTests/UmengAnalyticsTests.mm`
- Create: `example/ios/ReactNativeUmengExampleTests/UmengShareTests.mm`
- Modify: `example/ios/ReactNativeUmengExample/AppDelegate.swift`
- Modify: `example/ios/ReactNativeUmengExample/Info.plist`
- Create: `example/ios/ReactNativeUmengExample/ReactNativeUmengExample.entitlements`
- Create: `example/ios/ReactNativeUmengExample/SceneDelegateFixture.swift`
- Modify: `example/ios/ReactNativeUmengExample.xcodeproj/project.pbxproj`

**Interfaces:**
- init 前 Analytics 同步 no-op。
- init 前 Share/isInstalled reject `E_NOT_INITIALIZED`。
- request registry 每个 Promise 只 settle 一次；`invalidate` reject 全部 pending。

- [ ] **Step 1: 写 Analytics/Share lifecycle XCTest**

fake adapters 覆盖 init 前零调用、init 后转发、cancel/failure reject、同步 exception、callback/destroy 竞速、迟到 callback、`invalidate` 清理。

Run:

```sh
xcodebuild test -workspace example/ios/ReactNativeUmengExample.xcworkspace -scheme ReactNativeUmengExample -destination 'platform=iOS Simulator,name=iPhone 17'
```

Expected before implementation: FAIL。

- [ ] **Step 2: 实现 Analytics gate 与 Share registry**

Analytics 每个方法第一行检查 bootstrap；未 initialized 直接 return。Share 在取得 `UMSocialManager` 前 gate；所有 completion 通过 registry settle guard。`invalidate` 以 `E_SHARE_FAILED` 结束 pending，迟到 callback 只记录并忽略。

- [ ] **Step 3: 双路 AppDelegate 转发**

加入 `import ReactNativeUmeng`；现有 `import React` 已暴露 `RCTLinkingManager`。URL 与 UL 分别先计算两个结果再 OR，禁止短路：

```swift
let umengHandled = UmengBootstrap.shared().handleOpen(url, options: options)
let reactHandled = RCTLinkingManager.application(application, open: url, options: options)
return umengHandled || reactHandled
```

Universal Link 同样独立调用 Umeng 与 `RCTLinkingManager.application(_:continue:restorationHandler:)`。

- [ ] **Step 4: 补 Info、entitlements 与 Scene compile fixture**

Info.plist：

- `LSApplicationQueriesSchemes`: `weixin`、`dingtalk`、`dingtalk-open`。
- `CFBundleURLTypes`: 使用可辨识的 App ID/AppKey 占位原值，不额外拼前缀。
- 删除空 `NSLocationWhenInUseUsageDescription`。

entitlements 使用 `applinks:your.host` 占位；pbxproj Debug/Release 均设置 `CODE_SIGN_ENTITLEMENTS`。Scene fixture 覆盖 warm URL、warm UL 与 `willConnectTo` 的 cold connection options，只加入 Compile Sources，不在 runtime manifest 注册。

- [ ] **Step 5: Swift import/call、Codegen 与 build 验证**

```sh
xcodebuild test -workspace example/ios/ReactNativeUmengExample.xcworkspace -scheme ReactNativeUmengExample -destination 'platform=iOS Simulator,name=iPhone 17'
yarn turbo run build:ios --force
rg -n 'Umeng(Common|Analytics|Share)' example/ios/build/generated/ios/RCTModuleProviders.mm
```

Expected: XCTest/build PASS；provider 三个映射齐全。真实平台回跳仍记真机待验。

- [ ] **Step 6: 提交**

```sh
git add ios example/ios
git commit -m "fix(ios): harden callbacks and sharing"
```

---

### Task 11: 建立 package、consumer、Turbo、CI 与 release 门禁

**Files:**
- Create: `scripts/verify-package.mjs`
- Create: `scripts/verify-consumers.mjs`
- Create: `scripts/verify-publish-contract.mjs`
- Modify: `package.json`
- Modify: `turbo.json`
- Create: `.github/workflows/project-validation.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Produces scripts:

```text
yarn verify:package
yarn verify:consumers
yarn verify:publish-contract
```

- `verify-consumers` 运行时在系统 temp 创建 workspace 外 fixture，不提交伪 consumer 目录。

- [ ] **Step 1: 写 pack 内容失败测试**

`verify-package.mjs` 解析 `npm pack --dry-run --json`，断言 tarball 含 source、lib、android、ios、Podspec、package metadata，且不含 tests、Pods、Gradle/build cache。它还断言 `package.json#files` 每个字面路径真实存在。

Run:

```sh
node scripts/verify-package.mjs
```

Expected: FAIL，至少报告不存在的 `react-native.config.js` 或尚未 prepare 的 lib。

- [ ] **Step 2: 写 workspace 外 consumer smoke**

`verify-consumers.mjs` 使用 `fs.mkdtemp(path.join(os.tmpdir(), 'umeng-consumer-'))`，依次：

1. `yarn prepare` 与 `npm pack --json`。
2. 写带 `"packageManager": "yarn@4.11.0"` 的独立 package.json 与 `nodeLinker: node-modules` 的 `.yarnrc.yml`，用 Yarn 安装 tarball + 全部 peers。
3. 断言 package root 解析路径位于 temp `node_modules`。
4. 用独立 Metro config bundle package root、`source` condition、`lib/module`。
5. 用隔离 Jest 加载 `./mock`，验证 success resolve、cancel/failure reject。
6. finally 删除 temp；失败保留路径到日志便于诊断。

不得设置回源本仓的 alias、resolver 或 watchFolders。

根 scripts 增加：

```json
"verify:package": "node scripts/verify-package.mjs",
"verify:consumers": "node scripts/verify-consumers.mjs",
"verify:publish-contract": "node scripts/verify-publish-contract.mjs"
```

- [ ] **Step 3: 修 Turbo root inputs**

全部根输入使用 `$TURBO_ROOT$/...`，覆盖：

```text
package.json yarn.lock babel/tsconfig/codegen src/** android/** ios/** *.podspec
example/package.json example/src/** example/android/** example/ios/**
```

排除 build/Pods/.gradle。

- [ ] **Step 4: 写 publish contract verifier**

比较最新 tag 与 HEAD 的：

```text
dependencies peerDependencies exports codegenConfig files
react-native-builder-bob Podspec source/tag native build metadata
```

脚本用无副作用的 `yarn release-it --release-version` 计算 conventional commits 将产生的下一版本。publish contract 变化但没有版本增量时失败；公共类型、peer floor 或初始化行为变化时要求计算结果至少为 minor。当前 0.x 本轮必须计算出 minor，不能在 PR 内手改 package version 后让 release-it 再次重复 bump。

- [ ] **Step 5: 新增 repo 专用 workflow**

`.github/workflows/project-validation.yml` 用 path filter 路由：

- JS/root config → lint/typecheck/Jest/prepare/dependency/package/consumer/website/native。
- example JS/Babel/Metro → consumer bundle + native。
- Android → unit/release/manifest/minify。
- iOS → Pod/Codegen/XCTest/build/provider。
- website → llms tests/generation/typecheck/build。
- AGENTS/CLAUDE → instruction verifier。

不修改 org 同步的 `.github/workflows/ci.yml`。

- [ ] **Step 6: 修 release 验证与触发路径**

`.github/workflows/release.yml` 的 publish contract paths 加 `package.json`、Podspec、源码与影响 exports/codegen/files/Bob 的根配置。Verify 阶段执行：

```sh
yarn lint
yarn typecheck
yarn test --maxWorkers=2
yarn prepare
yarn verify:package
yarn verify:consumers
yarn verify:publish-contract
```

保留 App bot/OIDC/skip-ci 机制。把本地修改记录为需同步回 org template 的 repo-specific 例外，不改 `.github/workflows/ci.yml`。

- [ ] **Step 7: 运行本地可用验证**

```sh
yarn prepare
yarn verify:dependencies
yarn verify:package
yarn verify:consumers
yarn verify:publish-contract
yarn turbo run build:ios --dry=json
yarn turbo run build:android --dry=json
```

Expected: 非 Android SDK 的检查全部 PASS；dry-run 输入包含根路径。Android 实构建仍待 CI。

- [ ] **Step 8: 提交**

```sh
git add scripts package.json turbo.json .github/workflows/project-validation.yml .github/workflows/release.yml CONTRIBUTING.md
git commit -m "ci: verify consumer and release contracts"
```

---

### Task 12: 同步 README、website、llms、example 与迁移说明

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `example/README.md`
- Modify: `example/src/App.tsx`
- Modify: `website/scripts/build-llms.js`
- Modify: `website/scripts/build-llms.test.js`
- Modify: `website/src/pages/index.tsx`
- Modify: `website/docusaurus.config.ts`
- Delete: `website/src/clientModules/rn-globals.ts`
- Modify: `website/docs/**/*.md`

**Interfaces:**
- website docs 是 llms 唯一来源；生成文件保持 gitignored。
- 所有示例使用最终 API、完整配置与真实 skill 名 `umeng-share`。

- [ ] **Step 1: 先扩展 llms parser tests**

加入多行、单行、自闭合 LiveDemo：

```js
assert(!stripMdxNoise('<LiveDemo><Button /></LiveDemo>\nafter').includes('LiveDemo'));
assert(stripMdxNoise('<LiveDemo><Button /></LiveDemo>\nafter').includes('after'));
assert(!stripMdxNoise('<LiveDemo />\nafter').includes('LiveDemo'));
```

测试配置的 `baseUrl` 使索引链接为 `/react-native-umeng/md/...`，并实际运行 main 后断言 `llms.txt`/`llms-full.txt` 标题、Common/Share 关键片段。

Run:

```sh
node website/scripts/build-llms.test.js
```

Expected: FAIL，旧 parser 不处理单行/自闭合且索引缺 baseUrl。

- [ ] **Step 2: 修 parser 与 baseUrl**

`build-llms.js` 同时支持三种 LiveDemo，不能吞后文；从 Docusaurus config 读取/解析 baseUrl 并生成站点部署路径。生成产物继续写 `website/static` 且不提交。

- [ ] **Step 3: 更新安装、初始化、API 与 mock 文档**

修改 README、example README/App 以及 website 的 intro、installation、quick-start、privacy、common、analytics、testing：

- 授权前 `preInit` 只做 JS 校验/缓存。
- init 前 Share → `E_NOT_INITIALIZED`，Analytics no-op。
- 完整 peers、Design/Reanimated/Worklets 范围与 Babel plugin。
- public success-only `ShareResult`、mock cancel/failure reject。
- README 微信示例给齐 App ID、secret、Universal Link；example 明确授权前/后按钮顺序。
- example README 删除 npm 建议，只保留 yarn。

- [ ] **Step 4: 更新 Android/iOS 原生配置与排障**

修改 native-setup 两页与 troubleshooting：

- Android FileProvider、Jetifier、精确 Activity/超类、host compile deps、callback component enabled 状态、R8 与撤回同意流程。
- iOS URL Types 原值、queries、Associated Domains/AASA、AppDelegate/SceneDelegate 双转发。
- init gate、owner unmount、loading failure、session/busy 与真机验收边界。

- [ ] **Step 5: 修分享、首页与 skill 页面**

修改 sharing、Share API、Platform/Host API、首页和 skills 页：

- 删除 Bottom Sheet。
- 首页不存在的 `{ share }` 改为真实 `Share.openSheet`/`Share.share*`。
- OS 判断只从 `react-native` 导入 `Platform` 并别名。
- `unif-umeng` 全部改 `umeng-share`，GitHub 链接指向 `skills/umeng-share`。
- 未安装平台在显示模式仍可点击并 reject；文档锁定 Host/session 约束。

- [ ] **Step 6: 删除已无用途的 Bottom Sheet web shim**

从 `docusaurus.config.ts` 删除 `rn-globals` client module；删除文件。若代码搜索仍有除历史设计外的 `global` 依赖，先修实际调用再删除，不能保留过时注释。

- [ ] **Step 7: 生成并验证网站**

```sh
node website/scripts/build-llms.test.js
yarn workspace @unif/react-native-umeng-website build:llms
yarn workspace @unif/react-native-umeng-website typecheck
yarn workspace @unif/react-native-umeng-website build
rg -n 'Common\\.preInit|E_NOT_INITIALIZED|umeng-share' website/static/llms.txt website/static/llms-full.txt
```

Expected: 全部 PASS；生成链接带 `/react-native-umeng/` baseUrl；无 LiveDemo 标签泄漏。

- [ ] **Step 8: 更新 CHANGELOG migration**

在 Unreleased/目标 minor 版本逐项列公共类型收窄、peer floor、JS-only preInit、init gate、Android callback component 与撤回同意流程。不得提前写实际发布日期。

- [ ] **Step 9: 提交**

```sh
git add README.md CHANGELOG.md example/README.md example/src/App.tsx website
git commit -m "docs: align consumer integration guidance"
```

---

### Task 13: 重写 `AGENTS.md` 并收敛 `CLAUDE.md`

**Files:**
- Create: `scripts/verify-agent-instructions.mjs`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `package.json`

**Interfaces:**
- `AGENTS.md` 是唯一项目规则源。
- `CLAUDE.md` 可见内容只有 `@AGENTS.md`。
- Produces: `yarn verify:agent-instructions`。

- [ ] **Step 1: 写失败 verifier**

脚本断言：

```js
assert.equal(read('CLAUDE.md').trim(), '@AGENTS.md');
assert(!read('AGENTS.md').includes('规范统一见 **[CLAUDE.md]'));
assert(read('AGENTS.md').includes('skills/umeng-share'));
assert(!read('AGENTS.md').includes('skills/unif-umeng'));
```

扫描 active `AGENTS.md`、README、website docs；排除 `docs/superpowers/**` 历史记录。检查本地 Markdown links 存在，并核对 `package.json` 的三项依赖范围。

同时在根 scripts 增加：

```json
"verify:agent-instructions": "node scripts/verify-agent-instructions.mjs"
```

Run:

```sh
node scripts/verify-agent-instructions.mjs
```

Expected: FAIL，当前引用方向相反且规则仍在 CLAUDE。

- [ ] **Step 2: 按最终代码重写 AGENTS**

内容覆盖中文偏好、仓库定位、命令、目录、最终 API/隐私状态机、ShareSheet、Android/iOS setup、测试/mock、构建/发布、文档/llms 与每次库变更后的 skill 检查。不得机械复制旧 PIPL、URL scheme 前缀或旧 skill 名。

- [ ] **Step 3: 收敛 CLAUDE**

`CLAUDE.md` 只写：

```text
@AGENTS.md
```

不加标题、说明或反向链接；不把字面量 `\n` 写入文件。

- [ ] **Step 4: 运行 verifier 与核心检查**

```sh
node scripts/verify-agent-instructions.mjs
yarn typecheck
yarn lint
git diff --check
```

Expected: PASS。

- [ ] **Step 5: 提交**

```sh
git add AGENTS.md CLAUDE.md scripts/verify-agent-instructions.mjs package.json
git commit -m "docs: make agents the instruction source"
```

---

### Task 14: 同步 sibling `umeng-share` skill

> **Execution requirement:** 进入本任务前必须读取并使用 `superpowers:writing-skills`；同时读取 sibling repo 的 `AGENTS.md` 全文。

**Files (sibling repo only):**
- Modify: `../skills/skills/umeng-share/SKILL.md`
- Modify: `../skills/skills/umeng-share/references/native-setup.md`
- Modify: `../skills/skills/umeng-share/references/troubleshooting.md`
- Modify: `../skills/skills/umeng-share/assets/ShareEntry.tsx`
- Modify: `../skills/skills/umeng-share/assets/WXEntryActivity.kt`
- Create: `../skills/skills/umeng-share/assets/DDShareActivity.kt`
- Modify: `../skills/skills/umeng-share/scripts/doctor.sh`
- Modify: `../skills/skills/umeng-share/scripts/doctor.test.sh`

**Interfaces:**
- Skill version: `0.2.1` → `0.2.2`。
- Marketplace manifest 本轮不修改：当前 sibling repo 正有用户未提交迁移，且没有独立 `umeng-share` marketplace version；不得把无关变更带入提交。

- [ ] **Step 1: 审计并保护 sibling dirty worktree**

```sh
git -C ../skills status --short
git -C ../skills diff -- skills/umeng-share
git -C ../skills diff --cached --name-only
```

Expected: 记录全部既有脏文件和用户原有 staged 路径；`skills/umeng-share` 当前基线无本轮改动。若 workspace 权限阻止写入，申请仅针对 `/Users/liulijun/tongyi/design/skills/skills/umeng-share` 的权限；未获权限则报告阻塞。

- [ ] **Step 2: 先扩 doctor red fixtures**

新增 missing/ok fixture，检查：

- 主包与完整 peers/版本。
- Worklets Babel plugin 存在且位于最后。
- `android.enableJetifier=true`。
- `.wxapi.WXEntryActivity : WXCallbackActivity`。
- `.ddshare.DDShareActivity : DingCallBack`。
- iOS queries、URL Types、Associated Domains、AppDelegate URL/UL 双转发。
- 代码同时出现 `Common.preInit` 与授权后的 `Common.init`。

Run:

```sh
bash ../skills/skills/umeng-share/scripts/doctor.test.sh
```

Expected: FAIL，旧 doctor 未覆盖新门禁。

- [ ] **Step 3: 更新 SKILL 与 references**

明确：

- `preInit` 只在 JS 校验/缓存，授权前零 vendor API。
- `init` 才进行全部 native 初始化。
- init 前 Share reject、Analytics no-op。
- 完整 peers/Worklets plugin。
- Android/iOS 最终配置、错误契约、真机边界。
- 全量 API 继续路由 llms，不复制逐 API 镜像。

- [ ] **Step 4: 更新可复制 assets**

`ShareEntry.tsx` 增加初始化前置；`WXEntryActivity.kt` 改成可编译 `WXCallbackActivity` 模板；新增可编译 `DDShareActivity.kt`。不保留占位超类或待补实现注释。

- [ ] **Step 5: 实现 doctor 并运行 focused checks**

```sh
bash ../skills/skills/umeng-share/scripts/doctor.test.sh
PYTHONDONTWRITEBYTECODE=1 python3 ../skills/scripts/quick_validate.py ../skills/skills/umeng-share
git -C ../skills diff --check -- skills/umeng-share
```

Expected: PASS。

- [ ] **Step 6: 运行 skill 仓官方全量验证**

在 `../skills` 运行：

```sh
python3 scripts/validate_repository.py
python3 scripts/validate_portal_consistency.py
for test_file in skills/*/scripts/doctor.test.sh; do bash "$test_file"; done
```

Expected: 本轮 `umeng-share` checks PASS。若全量验证被 sibling 其他既有未提交改动阻塞，保存具体失败并证明 focused checks PASS；不得修改/提交无关文件求绿。

- [ ] **Step 7: 精确提交 sibling 文件**

```sh
git -C ../skills add \
  skills/umeng-share/SKILL.md \
  skills/umeng-share/references/native-setup.md \
  skills/umeng-share/references/troubleshooting.md \
  skills/umeng-share/assets/ShareEntry.tsx \
  skills/umeng-share/assets/WXEntryActivity.kt \
  skills/umeng-share/assets/DDShareActivity.kt \
  skills/umeng-share/scripts/doctor.sh \
  skills/umeng-share/scripts/doctor.test.sh
git -C ../skills diff --cached -- skills/umeng-share
git -C ../skills commit --only \
  skills/umeng-share/SKILL.md \
  skills/umeng-share/references/native-setup.md \
  skills/umeng-share/references/troubleshooting.md \
  skills/umeng-share/assets/ShareEntry.tsx \
  skills/umeng-share/assets/WXEntryActivity.kt \
  skills/umeng-share/assets/DDShareActivity.kt \
  skills/umeng-share/scripts/doctor.sh \
  skills/umeng-share/scripts/doctor.test.sh \
  -m "docs(umeng-share): align privacy integration"
git -C ../skills show --name-only --format=oneline -1
git -C ../skills diff --cached --name-only
```

Expected commit names: 仅上述 `skills/umeng-share/**`。`git commit --only` 不得带入用户原有 staged 文件；提交后最后一条命令仍应列出任务开始前记录的原有 staged 路径。

---

### Task 15: 全量验证、审查与交付记录

**Files:**
- Modify only if verification finds an in-scope defect.

**Interfaces:**
- Produces: library commit list、skill commit、真实验证证据、明确 deferred Android/真机矩阵。

- [ ] **Step 1: 运行完整 JS、依赖、package 与 docs 门禁**

```sh
yarn install --immutable
yarn lint
yarn typecheck
yarn test --maxWorkers=2
yarn prepare
yarn verify:dependencies
yarn verify:package
yarn verify:consumers
yarn verify:agent-instructions
yarn verify:publish-contract
node website/scripts/build-llms.test.js
yarn workspace @unif/react-native-umeng-website build:llms
yarn workspace @unif/react-native-umeng-website typecheck
yarn workspace @unif/react-native-umeng-website build
git diff --check
```

Expected: 全部退出 0。

- [ ] **Step 2: 运行 iOS 完整门禁**

```sh
xcodebuild test -workspace example/ios/ReactNativeUmengExample.xcworkspace -scheme ReactNativeUmengExample -destination 'platform=iOS Simulator,name=iPhone 17'
yarn turbo run build:ios --force
```

Expected: PASS；若环境/Pods 网络阻塞，报告原始命令与错误，不能概括成代码通过。

- [ ] **Step 3: 明确 Android CI 待验命令**

本机只重跑：

```sh
node scripts/verify-native-contract.mjs --platform android
xmllint --noout android/src/main/AndroidManifest.xml
xmllint --noout android/src/main/res/xml/react_native_umeng_file_paths.xml
```

CI/有 SDK 环境必须执行：

```sh
./example/android/gradlew -p example/android testDebugUnitTest
./example/android/gradlew -p example/android :app:processReleaseMainManifest :app:assembleRelease
```

交付记录必须写“Android 静态验证通过；Gradle/unit/release/manifest/R8 待 CI”，除非拿到实际 CI 绿色证据。

- [ ] **Step 4: 复核 tarball 与活跃文档无旧契约**

```sh
npm pack --dry-run --json
if rg -n 'skills/unif-umeng|export \\* as|@gorhom/bottom-sheet' AGENTS.md README.md package.json example website src; then
  echo "发现活跃旧契约" >&2
  exit 1
fi
if rg -n '授权前.*(UMConfigure|setPlaform|setWeixin|setDing)' AGENTS.md README.md website/docs; then
  echo "发现授权前 vendor 调用文案" >&2
  exit 1
fi
```

Expected: 两个 `rg` 均无活跃错误命中；历史 `docs/superpowers/**` 不在扫描范围。

- [ ] **Step 5: 请求 code review**

调用 `superpowers:requesting-code-review`，审查范围至少包括隐私零调用、竞态、原生 settle、依赖/consumer、跨仓 skill。逐项验证 reviewer finding，不盲目接受。

- [ ] **Step 6: 最终工作区与提交核对**

```sh
git status --short
git log --oneline --decorate -20
git -C ../skills status --short
git -C ../skills log -1 --oneline
```

Expected: library repo 无意外未提交文件；skills repo 只保留用户原有 dirty changes，本轮 `umeng-share` 已独立 commit。

- [ ] **Step 7: 交付**

最终报告：

- library commit(s) 与 sibling skill commit。
- 每条实际执行命令及 PASS/FAIL。
- Android SDK/CI 待验项。
- 微信/钉钉带凭据真机待验项。
- 若任何门禁未完成，状态保持未完成，不使用“全部修复完成”。
