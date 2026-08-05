# Umeng Example 合规初始化与分享展厅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单文件验证页改造成基于 Design 0.20 的合规初始化、平台检测、分享与 Analytics 产品化展厅，并把开发/example 运行图迁到 RN 0.86.2。

**Architecture:** example 使用本地 typed stack navigation；纯函数负责配置校验、状态转换、payload 与错误分类，React Provider 只编排公开的 `Common`、`Share`、`Analytics` API。根节点只挂一个 `ShareSheetHost`，页面按 setup、home、platforms、sheet、direct、analytics、logs 拆分。

**Tech Stack:** React Native 0.86.2、React 19.2.3、TypeScript 6、Jest 29、Testing Library、`@unif/react-native-design@0.20.0`、`@unif/react-native-umeng`。

## Global Constraints

- 根开发图和 example 必须只解析 `react-native: "0.86.2"`、`react: "19.2.3"`；匹配的 `@react-native/*` preset/config 为 `0.86.2`，example CLI 为 `20.1.0`。
- Umeng 的公开 API、类型、Codegen、native bridge 和 `peerDependencies` 不得修改。
- Design 组件只从包根导入；颜色只用 `useColors()`，样式只用模块顶层 `makeStyles` + `useThemedStyles()`；不得新增硬编码 hex/rgba、RN `Pressable + Text` 等价控件或 `console.*`。
- `ShareSheetHost` 在 `ThemeProvider` 内且全 App 只挂一次；业务页面不得再挂 Host。
- 凭据与同意状态只存内存；不写源码常量、AsyncStorage、日志、测试快照或磁盘。
- `preInit(config)` 只在用户提交有效表单后调用；`init()` 无参且只在未预选的明示同意后调用。
- 只支持 `Platform.WECHAT_SESSION`、`Platform.DINGTALK` 与 `text/image/link`；Analytics 是同步 `void`，不得 `await` 或记录“上报成功”。
- `E_USER_CANCEL` 是中性结果；其他公开 ErrorCode 必须按规格分类。日志不得包含 appkey、secret、App ID、分享正文或完整 URL。
- Carousel 5 / RNGH 3 只保留现有精确 scoped allowlist；禁止 `--force`、`--legacy-peer-deps`、全局 override 或降级 RNGH。
- iOS 回调必须同时调用 Umeng handler 与 `RCTLinkingManager` 后再 OR；Android example manifest 不重复声明 callback Activity，但宿主包名下 Kotlin callback 类和 compile dependencies 必须保留。
- 所有行为代码遵循 TDD：先运行能因缺少目标行为而失败的测试，再写最小实现；配置/生成文件使用可执行 contract 作为 RED。

---

### Task 1: 对齐 RN 0.86.2 依赖图与原生宿主模板

**Files:**
- Modify: `package.json`
- Modify: `example/package.json`
- Modify: `yarn.lock`
- Modify: `scripts/verify-dependencies.mjs`
- Modify: `example/android/settings.gradle`
- Modify: `example/android/build.gradle`
- Modify: `example/android/gradle.properties`
- Modify: `example/android/gradle/wrapper/gradle-wrapper.properties`
- Modify: `example/android/app/build.gradle`
- Modify: `example/android/app/src/main/java/unif/reactnativeumeng/example/MainActivity.kt`
- Modify: `example/android/app/src/main/java/unif/reactnativeumeng/example/MainApplication.kt`
- Modify: `example/ios/Podfile`
- Modify: `example/ios/ReactNativeUmengExample/AppDelegate.swift`
- Modify: `example/ios/ReactNativeUmengExample.xcodeproj/project.pbxproj`
- Modify: `example/ios/Podfile.lock`
- Test: `scripts/__tests__/release-validation.test.mjs`

**Interfaces:**
- Consumes: Design 0.20 的闭区间 RN/React contract，以及当前 Umeng callback、XCTest target、R8 和 Codegen 配置。
- Produces: 单一 RN 0.86.2 根/example 运行图；`yarn install --immutable` 可复验的 lockfile；不变的 Umeng public peer contract。

- [ ] **Step 1: 写依赖 contract 的失败测试**

在 `scripts/__tests__/release-validation.test.mjs` 增加字面 fixture，验证：

```js
assert.equal(root.devDependencies['react-native'], '0.86.2');
assert.equal(example.dependencies['react-native'], '0.86.2');
assert.equal(example.devDependencies['@react-native/metro-config'], '0.86.2');
assert.equal(
  example.devDependencies['@react-native-community/cli-platform-ios'],
  '20.1.0'
);
assert.equal(root.peerDependencies['react-native'], '*');
```

同时让 `scripts/verify-dependencies.mjs` 对真实 manifest 执行同一 contract，并继续验证
Carousel `5.0.0` / RNGH `3.1.0` 的精确例外。

- [ ] **Step 2: 运行 RED**

Run:

```sh
yarn verify:release-validation
yarn verify:dependencies
```

Expected: 至少一条因根/example 仍为 RN `0.85.3` 或 `@react-native/* 0.85.3` 而失败；不能接受语法错误或缺 fixture 造成的失败。

- [ ] **Step 3: 更新 manifest 与 lockfile**

把根和 example 的 React Native 运行/工具依赖改成 Global Constraints 的精确值；example
增加独立测试所需的 `test` script、Jest、Testing Library、`react-test-renderer@19.2.3`
和 types。使用 Yarn 4 正常更新 lockfile：

```json
{
  "scripts": {
    "test": "jest"
  },
  "dependencies": {
    "react": "19.2.3",
    "react-native": "0.86.2"
  },
  "devDependencies": {
    "@react-native/babel-preset": "0.86.2",
    "@react-native/jest-preset": "0.86.2",
    "@react-native/metro-config": "0.86.2",
    "@react-native/typescript-config": "0.86.2",
    "react-test-renderer": "19.2.3"
  }
}
```

Run: `yarn install`

- [ ] **Step 4: 迁移 RN 原生模板但保留 Umeng 定制**

以本机 `react-native-design` 的 RN 0.86.2 example 为模板参考，逐项迁移 Android/iOS
shell；不要整目录覆盖。保留：

```text
Android: applicationId、newArchEnabled、Jetifier、R8、WXEntryActivity/DDShareActivity 源文件与 SDK compile dependencies
iOS: bundle id、ReactNativeUmeng module import、URL/Universal Link 双路 callback、Scene fixture、4 个 XCTest 文件和 test target
```

完成后运行 `bundle exec pod install --project-directory=example/ios` 更新 Pod lock。

- [ ] **Step 5: 运行 GREEN 与 immutable 复验**

Run:

```sh
yarn verify:release-validation
yarn verify:dependencies
yarn install --immutable
yarn typecheck
```

Expected: 全部 exit 0；依赖检查只报告已批准的精确 Carousel/RNGH 例外。

- [ ] **Step 6: 自审并提交**

Run:

```sh
git diff --check
git diff -- package.json example/package.json scripts/verify-dependencies.mjs
git status --short
```

只暂存本任务文件，提交：

```sh
git commit -m "chore: align example with React Native 0.86"
```

---

### Task 2: 建立导航、日志、错误和分享素材纯领域模型

**Files:**
- Create: `example/src/navigation.ts`
- Create: `example/src/state/logs.ts`
- Create: `example/src/errors/classifyUmengError.ts`
- Create: `example/src/content/shareContent.ts`
- Create: `example/src/__tests__/navigation.test.ts`
- Create: `example/src/__tests__/logs.test.ts`
- Create: `example/src/__tests__/classifyUmengError.test.ts`
- Create: `example/src/__tests__/shareContent.test.ts`
- Modify: `example/jest.config.js`
- Create: `example/jest.setup.ts`

**Interfaces:**
- Consumes: `Platform`、`ErrorCode`、`UmengError`、`ShareSheetPayload`、`ShareTextOptions`、`ShareImageOptions`、`ShareLinkOptions`。
- Produces:
  - `type RouteId = 'setup' | 'home' | 'platforms' | 'sheet' | 'direct' | 'analytics' | 'logs'`
  - `navigationReducer(state, action): NavigationState`
  - `appendLog(logs, input): readonly DemoLog[]`、`clearLogs(): readonly []`
  - `classifyUmengError(error, scope): OperationFeedback`
  - `buildSheetPayload(draft)` 与 `buildDirectOptions(type, platform, draft)`

- [ ] **Step 1: 写导航与日志 RED**

测试使用字面期望：

```ts
expect(
  navigationReducer({ stack: ['setup'] }, { type: 'navigate', route: 'home' })
).toEqual({ stack: ['setup', 'home'] });
expect(
  navigationReducer({ stack: ['setup'] }, { type: 'back' })
).toEqual({ stack: ['setup'] });

const logs = appendLog([], {
  now: new Date('2026-08-03T10:20:30.123Z'),
  level: 'info',
  scope: 'analytics',
  message: 'JS 已调用 Analytics.onEvent',
});
expect(logs[0]?.message).toBe('JS 已调用 Analytics.onEvent');
expect(JSON.stringify(logs)).not.toContain('secret');
```

日志上限固定为 `100`，新项在前；日志输入类型不接受 config/payload 对象，只接受已经过
选择的安全 message。

- [ ] **Step 2: 写错误分类与 payload RED**

使用真实 `UmengError`：

```ts
expect(
  classifyUmengError(
    new UmengError('E_USER_CANCEL', 'cancelled'),
    'share'
  )
).toEqual({
  tone: 'neutral',
  code: 'E_USER_CANCEL',
  message: '已取消分享',
  restartRequired: false,
});

expect(
  buildSheetPayload({
    type: 'link',
    text: '忽略',
    image: 'https://host/image.png',
    title: '标题',
    url: 'https://host/page',
    description: '说明',
    thumb: 'https://host/thumb.png',
  })
).toEqual({
  type: 'link',
  title: '标题',
  url: 'https://host/page',
  description: '说明',
  thumb: 'https://host/thumb.png',
});
```

逐项覆盖七个公开 ErrorCode、非 `UmengError`、三类 sheet payload、两平台三类 direct
options，以及 HTTP 被 example 本地策略拒绝。

- [ ] **Step 3: 运行 RED**

Run: `yarn example test navigation logs classifyUmengError shareContent`

Expected: FAIL，原因是四个模块尚不存在。

- [ ] **Step 4: 写最小实现**

`navigation.ts` 使用穷尽 reducer：

```ts
export type NavigationAction =
  | { type: 'navigate'; route: RouteId }
  | { type: 'back' }
  | { type: 'reset'; route: RouteId };
```

`classifyUmengError.ts` 返回：

```ts
export type OperationFeedback = {
  tone: 'neutral' | 'warning' | 'error';
  code: ErrorCode | 'E_NON_UMENG';
  message: string;
  restartRequired: boolean;
};
```

`shareContent.ts` 集中声明可编辑 HTTPS 默认素材，并对 `image`、`thumb`、`url` 使用
`new URL(value)` + `protocol === 'https:'` + 非空 hostname 校验。不要记录或导出用户的
运行时 payload。

- [ ] **Step 5: 运行 GREEN 并重构**

Run:

```sh
yarn example test navigation logs classifyUmengError shareContent
yarn typecheck
yarn lint
```

Expected: 全部 exit 0，测试没有 snapshot、mirror assertion 或对 mock 元素的断言。

- [ ] **Step 6: 提交**

Run: `git diff --check`

```sh
git commit -m "feat: add umeng showcase domain model"
```

---

### Task 3: 实现凭据校验与合规初始化状态机

**Files:**
- Create: `example/src/state/setupState.ts`
- Create: `example/src/state/ShowcaseProvider.tsx`
- Create: `example/src/state/useShowcase.ts`
- Create: `example/src/__tests__/setupState.test.ts`
- Create: `example/src/__tests__/ShowcaseProvider.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `RouteId`、`appendLog`、`classifyUmengError`；公开 `Common.preInit`、`Common.init`、`Common.isInited`。
- Produces:
  - `CredentialDraft`、`CredentialErrors`
  - `buildInitConfig(draft, os): ValidationResult<UmengInitConfig>`
  - `SetupPhase = 'editing' | 'preInitializing' | 'awaitingConsent' | 'initializing' | 'initialized' | 'initFailedLocked'`
  - `setupReducer(state, action): SetupState`
  - `ShowcaseProvider` 与 `useShowcase()` actions

- [ ] **Step 1: 写凭据校验 RED**

覆盖：

```ts
const emptyDraft: CredentialDraft = {
  appkey: '',
  channel: '',
  wechatEnabled: false,
  wechatAppId: '',
  wechatAppSecret: '',
  wechatUniversalLink: '',
  dingtalkEnabled: false,
  dingtalkAppId: '',
};
const validBase: CredentialDraft = { ...emptyDraft, appkey: 'app-key' };

expect(buildInitConfig(emptyDraft, 'android')).toEqual({
  ok: false,
  errors: { appkey: '请输入 Umeng AppKey' },
});

expect(
  buildInitConfig(
    {
      ...validBase,
      wechatEnabled: false,
      wechatAppId: 'YOUR_WECHAT_APP_ID',
      wechatAppSecret: 'secret',
      wechatUniversalLink: 'https://host/',
      dingtalkEnabled: false,
      dingtalkAppId: 'ding',
    },
    'android'
  )
).toEqual({ ok: true, config: { appkey: 'app-key' } });
```

iOS 微信要求 App ID + secret + HTTPS Universal Link；Android 要求 App ID + secret，
Universal Link 填写时才校验；所有 `YOUR_...` 值拒绝。

- [ ] **Step 2: 写状态机与副作用 RED**

用官方 mock：

```ts
jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);
```

测试 `preInit` 失败回 `editing`、成功进入 `awaitingConsent` 并锁定；未勾选同意时不调用
`Common.init`；同意后 `Common.init()` 的 call arguments 是空数组；init reject 进入
`initFailedLocked`，同配置重试再次调用无参 `init()`；任何日志不含输入值。

- [ ] **Step 3: 运行 RED**

Run: `yarn example test setupState ShowcaseProvider`

Expected: FAIL，原因是 setup 模块和 Provider 尚不存在。

- [ ] **Step 4: 实现纯 reducer 与 Provider 编排**

Provider 暴露稳定接口：

```ts
export type SetupActions = {
  updateCredential: (field: keyof CredentialDraft, value: string | boolean) => void;
  preInitialize: () => Promise<void>;
  setConsent: (checked: boolean) => void;
  initialize: () => Promise<void>;
  retryInitialize: () => Promise<void>;
};
```

`preInitialize()` 先调用 `buildInitConfig`；invalid 不接触 `Common`。成功后把 config
浅冻结成内存 snapshot，清除 draft 中不再需要的 secret 展示值，并锁定编辑。Provider
只能把“是否配置微信/钉钉”等安全事实写入日志。

- [ ] **Step 5: 运行 GREEN**

Run:

```sh
yarn example test setupState ShowcaseProvider
yarn example test
yarn typecheck
yarn lint
```

Expected: 全部 exit 0；官方 mock 的调用在每个 test 后 reset。

- [ ] **Step 6: 提交**

```sh
git diff --check
git commit -m "feat: add compliant umeng setup flow"
```

---

### Task 4: 实现平台、分享和 Analytics 操作编排

**Files:**
- Create: `example/src/state/operations.ts`
- Create: `example/src/__tests__/operations.test.ts`
- Modify: `example/src/state/ShowcaseProvider.tsx`
- Modify: `example/src/state/useShowcase.ts`
- Modify: `example/src/__tests__/ShowcaseProvider.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 payload/error/log helpers；Task 3 的 Provider；公开 `Share.listPlatforms/isInstalled/openSheet/shareText/shareImage/shareLink` 与同步 `Analytics.*`。
- Produces:
  - `PlatformState`、`platformReducer`
  - `openShareSheet(draft, options)`
  - `shareDirect(type, platform, draft)`
  - `trackEvent/signIn/signOut`

- [ ] **Step 1: 写平台 RED**

验证 `listPlatforms` 成功按 `SUPPORTED_PLATFORMS` 保存；refresh reject 保留旧值并写错误
feedback；单平台 `isInstalled` 只更新目标；初始化前 action 返回且不调用 Share。

```ts
expect(afterFailedRefresh.items).toEqual(previousItems);
expect(afterFailedRefresh.feedback?.code).toBe('E_UNKNOWN');
```

- [ ] **Step 2: 写分享矩阵与 Analytics RED**

使用官方 mock 的 `shareCancel` / `shareFailed`：

```ts
const validDraft: ShareContentDraft = {
  text: '一段分享文字',
  image: 'https://host/image.png',
  title: '分享标题',
  url: 'https://host/page',
  description: '分享说明',
  thumb: 'https://host/thumb.png',
};
(Share.shareLink as jest.Mock).mockRejectedValueOnce(
  shareCancel(Platform.WECHAT_SESSION)
);
await actions.shareDirect('link', Platform.WECHAT_SESSION, validDraft);
expect(state.feedback).toMatchObject({
  tone: 'neutral',
  code: 'E_USER_CANCEL',
});
```

六个 direct 组合必须命中正确公开方法与完整 literal options；openSheet 覆盖三种 payload
及 `title/cancelText/subtitles/hideUninstalled`。Analytics 只在同步调用正常返回后追加
`JS 已调用 Analytics.<method>`；同步 throw 不追加成功事实。

- [ ] **Step 3: 运行 RED**

Run: `yarn example test operations ShowcaseProvider`

Expected: FAIL，原因是 operations/action 尚未实现。

- [ ] **Step 4: 写最小实现**

操作接口固定为：

```ts
export type DirectShareType = 'text' | 'image' | 'link';
export type ShowcaseActions = SetupActions & {
  refreshPlatforms: () => Promise<void>;
  checkPlatform: (platform: Platform) => Promise<void>;
  openShareSheet: (draft: SheetDraft) => Promise<void>;
  shareDirect: (
    type: DirectShareType,
    platform: Platform,
    draft: ShareContentDraft
  ) => Promise<void>;
  trackEvent: (eventId: string, params?: Record<string, string | number>) => void;
  signIn: (userId: string, provider?: string) => void;
  signOut: () => void;
};
export type SheetDraft = ShareContentDraft & {
  options: {
    title: string;
    cancelText: string;
    wechatSubtitle: string;
    dingtalkSubtitle: string;
    hideUninstalled: boolean;
  };
};
```

平台已知 `installed: false` 时阻止直发并生成 `E_PLATFORM_NOT_INSTALLED` 警告；未知状态先
调用 `isInstalled`，查询失败不得改写为未安装。分享成功只记录
`success@${result.platform}`，不记录正文/URL。

- [ ] **Step 5: 运行 GREEN**

Run:

```sh
yarn example test operations ShowcaseProvider
yarn example test
yarn typecheck
yarn lint
```

Expected: 全部 exit 0。

- [ ] **Step 6: 提交**

```sh
git diff --check
git commit -m "feat: add umeng showcase operations"
```

---

### Task 5: 组合 Design 页面与单一 ShareSheetHost

**Files:**
- Replace: `example/src/App.tsx`
- Create: `example/src/components/ShowcaseScaffold.tsx`
- Create: `example/src/components/CredentialForm.tsx`
- Create: `example/src/components/SharePayloadEditor.tsx`
- Create: `example/src/components/OperationFeedback.tsx`
- Create: `example/src/screens/SetupScreen.tsx`
- Create: `example/src/screens/HomeScreen.tsx`
- Create: `example/src/screens/PlatformsScreen.tsx`
- Create: `example/src/screens/SheetScreen.tsx`
- Create: `example/src/screens/DirectShareScreen.tsx`
- Create: `example/src/screens/AnalyticsScreen.tsx`
- Create: `example/src/screens/LogsScreen.tsx`
- Create: `example/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4 的 navigation、Provider state/actions、payload 与 feedback types。
- Produces: 七个可操作页面；根结构
  `GestureHandlerRootView > ThemeProvider > ShowcaseProvider > Screen + ShareSheetHost`。

- [ ] **Step 1: 写 App 行为 RED**

用 Testing Library 渲染真实 example App，Umeng 只用官方 mock。至少验证：

```ts
expect(screen.getByText('合规初始化')).toBeTruthy();
expect(screen.queryByText('分享展厅')).toBeNull();
fireEvent.changeText(screen.getByLabelText('Umeng AppKey'), 'app-key');
fireEvent.press(screen.getByRole('button', { name: '预初始化' }));
await screen.findByText('请阅读并明确同意隐私政策');
expect(Common.preInit).toHaveBeenCalledWith({ appkey: 'app-key' });
expect(Common.init).not.toHaveBeenCalled();
```

再覆盖明示勾选后 init、初始化后首页七路导航、返回、日志清空和分享 action 的可见反馈。
不要断言 Design 内部 DOM、样式数值或 snapshot。

- [ ] **Step 2: 运行 RED**

Run: `yarn example test App`

Expected: FAIL，因为旧 App 自动 preInit、存在源码凭据且没有新页面。

- [ ] **Step 3: 实现共享组件**

所有 Design imports 仅来自包根。示例骨架：

```tsx
<NavBar
  title={title}
  left={onBack ? { icon: 'arrow-left', onPress: onBack, accessibilityLabel: '返回' } : undefined}
/>
```

表单使用 `Form/FormGroup/FormRow/Input/PasswordInput/Switch`；选择使用 `Segmented`；
状态使用 `Tag/StatusDot`；动作使用 `Button/IconButton`；只在日志正文使用 RN
`Text selectable`。每个模块顶层声明 `makeStyles`，并通过 `useThemedStyles` 消费。

- [ ] **Step 4: 实现 setup、home 与平台页**

Setup 初始为空，不在 `useEffect` 调 `preInit`。Home 使用 `Grid`/`EntryCard` 进入
platforms、sheet、direct、analytics、logs；未 initialized 时只能停在 setup。
Platforms 显示上一次可信状态和刷新/单平台查询，不把查询错误显示为未安装。

- [ ] **Step 5: 实现分享、Analytics 与日志页**

Sheet 用 `Segmented` 切换 text/image/link 并编辑全部公开 payload/options；Direct 显示
两平台 × 三类型六动作。图片 URL 预览失败时禁用本次分享并给可恢复反馈。Analytics 页面
调用同步 action；Logs 最新在前、正文 selectable、可清空。

- [ ] **Step 6: 根装配与 GREEN**

`App.tsx` 只出现一次：

```tsx
<ThemeProvider>
  <ShowcaseProvider>
    <ExampleRouter />
    <ShareSheetHost />
  </ShowcaseProvider>
</ThemeProvider>
```

Run:

```sh
yarn example test App
yarn example test
yarn typecheck
yarn lint
```

Expected: 全部 exit 0；`rg -n "console\\.|#[0-9A-Fa-f]{3,8}|rgba\\(" example/src`
无命中。

- [ ] **Step 7: 提交**

```sh
git diff --check
git commit -m "feat: build umeng example showcase"
```

---

### Task 6: 收紧双端 Umeng 原生接线与自动化 contract

**Files:**
- Modify: `example/ios/ReactNativeUmengExample/Info.plist`
- Modify: `example/ios/ReactNativeUmengExample/AppDelegate.swift`
- Modify: `example/ios/ReactNativeUmengExample/SceneDelegateFixture.swift`
- Modify: `example/android/app/src/main/AndroidManifest.xml`
- Verify: `example/android/app/src/main/java/unif/reactnativeumeng/example/wxapi/WXEntryActivity.kt`
- Verify: `example/android/app/src/main/java/unif/reactnativeumeng/example/ddshare/DDShareActivity.kt`
- Modify: `scripts/verify-native-contract.mjs`
- Create: `scripts/verify-example-contract.mjs`
- Modify: `package.json`
- Test: `scripts/__tests__/release-validation.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 RN 0.86.2 shell；既有 Umeng callback classes、SDK dependencies 与 native contract。
- Produces: 无前缀 iOS scheme placeholders、双路非短路 callback、无重复 Android Activity 的 example，以及可执行 contract。

- [ ] **Step 1: 写原生配置 RED**

`verify-example-contract.mjs` 必须解析 example 文件并断言：

```js
assert(infoPlist.includes('<string>YOUR_WECHAT_APP_ID</string>'));
assert(!infoPlist.includes('wxYOUR'));
assert(infoPlist.includes('<string>YOUR_DINGTALK_APP_KEY_OR_CLIENT_ID</string>'));
assert(!exampleManifest.includes('android:name=".wxapi.WXEntryActivity"'));
assert(!exampleManifest.includes('android:name=".ddshare.DDShareActivity"'));
assert(appDelegate.includes('UmengBootstrap.shared().handleOpen'));
assert(appDelegate.includes('RCTLinkingManager.application'));
assert(appDelegate.includes('return umengHandled || reactHandled'));
```

同时检查 callback Kotlin 文件和 `example/android/app/build.gradle` 的四个 compile
dependencies 仍存在。把该脚本注册为 `yarn verify:example-contract`。

- [ ] **Step 2: 运行 RED**

Run: `yarn verify:example-contract`

Expected: FAIL，至少指出微信 scheme 带 `wx` 前缀或 example manifest 重复 Activity。

- [ ] **Step 3: 修改原生配置**

Info.plist 使用登记原值占位；Android manifest 删除两段重复 Activity，保留 MainActivity。
AppDelegate/Scene fixture 按以下控制流保持两个 handler 都执行：

```swift
let umengHandled = UmengBootstrap.shared().handleOpen(url, options: options)
let reactHandled = RCTLinkingManager.application(
  application,
  open: url,
  options: options
)
return umengHandled || reactHandled
```

Universal Link 同样先求两个布尔值再 OR，不写 `a() || b()` 短路调用。

- [ ] **Step 4: 运行 GREEN 与 native contract**

Run:

```sh
yarn verify:example-contract
node scripts/verify-native-contract.mjs --platform android
node scripts/verify-native-contract.mjs --platform ios
yarn verify:release-validation
```

Expected: 全部 exit 0。

- [ ] **Step 5: 构建验证并提交**

Run:

```sh
yarn example build:android
yarn example build:ios
```

若本机缺 Android SDK、Xcode signing 或 vendor network，完整保存原始失败证据，不修改
contract 来跳过；可执行的另一平台仍须完成。

```sh
git diff --check
git commit -m "fix: align umeng example native callbacks"
```

---

### Task 7: 完成 README、AGENTS 与全量验证

**Files:**
- Modify: `README.md`
- Replace: `example/README.md`
- Modify: `AGENTS.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/project-validation.yml`
- Modify: `turbo.json`

**Interfaces:**
- Consumes: Tasks 1–6 的最终命令、目录、依赖与真实平台边界。
- Produces: 可复制文档、准确的 RN 0.86.2 当前验证基线，以及 CI 对 example tests/contracts 的明确入口。

- [ ] **Step 1: 更新 CI contract 并先验证缺口**

在现有 JS job 增加：

```sh
yarn example test --maxWorkers=2
yarn verify:example-contract
```

保持根 `yarn test --maxWorkers=2 --coverage`、Android JVM/native/minified/merged manifest、
iOS native/XCTest/module-provider/build 门禁不变。先运行 Turbo dry-run，确认新任务能被
发现：

Run: `yarn turbo run test --dry=json`

Expected before wiring: example test 不在 task graph 或 contract 未执行。

- [ ] **Step 2: 写根 README 与 example README**

根 README 增加展厅入口和当前开发验证基线。example README 按以下顺序写完整命令与复制
边界：

```text
安装依赖 → 运行时填写凭据 → 预初始化 → 明示同意 → 平台检测
→ openSheet / 直发 → Analytics → iOS/Android 回调配置 → 自动化/真机矩阵
```

明确库接受绝对 HTTP/HTTPS，而 example 默认只放行 HTTPS；真实微信/钉钉回包、Universal
Link/AASA 只能真机/线上域名验收；仓库不保存 secret。

- [ ] **Step 3: 更新 AGENTS 当前事实**

把“目标运行时 RN 0.85”改成两层事实：

```text
当前仓库开发/example 验证基线：RN 0.86.2、React 19.2.3、Design 0.20.0。
发布包的 React/RN peer contract 保持 package.json 原值，本任务未收紧公共兼容范围。
```

同步常用命令加入 `yarn example test`、`yarn verify:example-contract`，不复制 website 或
Skill 的逐 API 文档。

- [ ] **Step 4: 运行完整 JS/contract 门禁**

Run:

```sh
yarn install --immutable
yarn verify:dependencies
yarn verify:agent-instructions
yarn verify:release-validation
yarn verify:package
yarn verify:consumers
yarn verify:example-contract
yarn typecheck
yarn lint
yarn test --maxWorkers=2 --coverage
yarn example test --maxWorkers=2
yarn prepare
```

Expected: 每条 exit 0，无 ignored failure、无新增 warning。

- [ ] **Step 5: 运行完整 native 门禁**

Run:

```sh
node scripts/verify-native-contract.mjs --platform android
node scripts/verify-native-contract.mjs --platform ios
yarn example build:android
yarn example build:ios
```

再按 project-validation workflow 执行 Android JVM、minified release/merged manifest
和 iOS XCTest/module-provider 命令。无法在本机执行的真机矩阵只记录为人工验收，不得用
simulator 结果冒充。

- [ ] **Step 6: 最终审查并提交**

Run:

```sh
git diff --check
git status --short
git diff --stat
```

逐条对照设计规格 13 节验收标准；确认没有 secret、`YOUR_...` 只存在原生文档占位、
安全校验 fixture 或文档提示而不是运行时默认凭据；example 源码没有
`console.*`/硬编码颜色，公共 API/peer 无变化。

```sh
git commit -m "docs: document umeng example showcase"
```
