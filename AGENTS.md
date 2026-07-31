# AGENTS.md
<!-- BEGIN UNIF REACT NATIVE STANDARD -->

## 共享标准启动

你维护的仓库是 `react-native-umeng`。本区块只负责启动与失效保护;完整共享流程由
`rn-library` Skill 管理,marker 外只保存本仓特有规则。

开始任何任务前:

1. 运行 `git status --short --branch`;位于 `main` 时,在首次写入前创建语义明确的任务分支。
2. 保留已有改动,不得覆盖、暂存或提交与当前任务无关的文件。
3. 查找并读取 `rn-library` 与 `umeng-share` Skill,两者叠加使用。
4. Skill 缺失时,按当前 Agent 选择一条全局安装命令:

```sh
# Codex
npx skills add unif-design/skills --skill rn-library --skill umeng-share --global --agent codex --yes

# Claude Code
npx skills add unif-design/skills --skill rn-library --skill umeng-share --global --agent claude-code --yes
```

安装完成后重新读取两个 Skill。安装失败、需要认证或仍无法读取时停止修改并报告,不得跳过
共享门禁。仓库正文只能补充或收紧共享规则;发现真实冲突时如实报告。

<!-- END UNIF REACT NATIVE STANDARD -->

## 仓库定位

`@unif/react-native-umeng` —— 友盟 RN 新架构桥,做两件事:**U-Share**(微信会话 + 钉钉分享)与 **U-App 移动统计**。目标运行时:**RN 0.85 新架构**(TurboModule)、React 19、TypeScript 6。UI 文案中文。首版只支持微信会话 + 钉钉(无朋友圈 / QQ / 微博)。

turbo-module 库(`create-react-native-library` `kotlin-objc`):JS 在 `src/`,原生在 `android/`(Kotlin)+ `ios/`(Objective-C++ `.mm`)。yarn workspaces 单仓库:库本体在根目录,`example/` 是宿主 RN app,`website/` 是 Docusaurus 文档站。

## 常用命令

除非另注,命令都在仓库根目录执行。

```sh
yarn                  # 安装(yarn 4.11,node 24.13,见 .nvmrc)
yarn typecheck        # tsc(noEmit,strict + noUncheckedIndexedAccess)
yarn lint             # eslint **/*.{js,ts,tsx}
yarn lint --fix       # 自动修复
yarn test             # jest(跑 src/__tests__/ 下的 JS / React 组件测试)
yarn test src/__tests__/share.test.ts    # 跑单文件
yarn test -t "pattern"                    # 按测试名过滤
yarn prepare          # react-native-builder-bob → lib/module(ESM)+ lib/typescript
yarn clean            # 清 lib/ + example 构建产物

# example 应用(真机验证分享,见下)
yarn example start    # metro
yarn example ios      # 构建并跑 iOS
yarn example android  # 构建并跑 Android

# 文档站
yarn workspace @unif/react-native-umeng-website build:llms
```

**只用 yarn** —— 项目依赖 yarn workspaces(`packageManager: yarn@4.11.0`、`nodeLinker: node-modules`、`nmHoistingLimits: workspaces`)。pre-commit hook(lefthook)对 staged 文件跑 `eslint` + `tsc`,native 仓还跑 `clang-format`(`.mm`)/ `ktlint`(`.kt`)。

## 架构与约定

### 对外暴露(`src/index.ts`)

三个命名空间 + 类型/常量/Error 的 barrel:

| 导出 | 内容 |
| --- | --- |
| `Common` | `preInit` / `init` / `isInited` —— 两段式初始化(PIPL) |
| `Share` | `shareText` / `shareImage` / `shareLink` / `openSheet` / `isInstalled` / `listPlatforms` |
| `Analytics` | `onEvent` / `signIn` / `signOut` —— 同步 void |
| `ShareSheetHost` | 命令式分享面板的宿主组件(根上挂一次) |
| `Platform` / `SUPPORTED_PLATFORMS` / `PLATFORM_*` / `UmengError` | 分享目标枚举 + 品牌色 / 文案常量 + 错误类 |

每个命名空间一个文件(`common.ts` / `share.ts` / `analytics.ts`),对应一个 TurboModule spec(`NativeUmengCommon.ts` / `NativeUmengShare.ts` / `NativeUmengAnalytics.ts`,`TurboModuleRegistry.getEnforcing`)。JS 层做参数校验 + 把 native 结果翻成 `ShareResult` / 抛 `UmengError`;codegen 名 `ReactNativeUmengSpec`,Android 包名 `com.unif.reactnativeumeng`。

### 两段式 init(PIPL,顺序不能反)

合规核心:用户同意《隐私协议》前 native 不持有 appkey、不上报。

- **`Common.preInit(config)`** — App 启动后立刻调(同意之前也可)。**所有 config 都在这里给**。
  - 行为 — 只在 JS 侧校验、标准化并保存不可变 config 快照;**不调用 native,不注册平台,不上报**。
- **`Common.init()`** — 用户同意后调,**无参**(config 已给 preInit),JS 才调用 `NativeUmengCommon.initialize(configSnapshot)`。
  - 例外 — 没先 `preInit` 直接 `init` 会 reject `E_NOT_INITIALIZED`;初始化开始后更换 config 会 reject `E_INVALID_OPTIONS`。

`preInit` 的 config 字段:

| 字段 | 必填 |
| --- | --- |
| `appkey` | 必填非空字符串 |
| `channel` / `dingtalkAppId` | 可选;出现时必须是非空字符串 |
| Android 微信 | `wechatAppId` + `wechatAppSecret` 同时出现;Universal Link 可选但出现时必须是带 host 的绝对 HTTPS URL |
| iOS 微信 | `wechatAppId` + `wechatAppSecret` + 带 host 的绝对 HTTPS `wechatUniversalLink` 同时出现 |

> **相同 config 的 `preInit` 与成功后的 `init` 都可安全重复。**
> JS 用 config 快照、`nativeStarted`、`initialized` 与 `initPromise` 管理并发;初始化开始后不得换 config。

#### 原生接线状态(不得跨平台泛化)

- **Android 当前已实现** —— `UmengBootstrapStateMachine` 在授权后的单次 `initialize(config)` 中依次执行 vendor preInit、平台注册、FileProvider 配置、正式 init 与 callback component enable;只接受同一 config,不确定 vendor 失败进入需重启的 terminal state。
- **iOS 当前尚未完成整改,不可发布** —— `src/NativeUmengCommon.ts` 已要求 `initialize(config)`,但 `ios/UmengCommon.mm` 仍导出旧 `preInit/init`,`ios/UmengBootstrap.mm` 仍在旧 `ensurePreInit` 阶段注册平台。`node scripts/verify-native-contract.mjs --platform ios` 当前应明确失败,不得把 JS / Android 契约写成 iOS 已生效。
- **iOS 整改目标** —— 按批准计划实现 Codegen `initialize`、同配置并发状态机与 terminal failure;主线程调用顺序为 Universal Link → 微信 `setPlaform` → 钉钉 `setPlaform` → `UMConfigure.initWithAppkey`。iOS 没有 vendor preInit API,不得臆造该阶段。完成 Task 9 / 10、native contract、XCTest、example 编译与真机矩阵前,不得声称 iOS 初始化闭环通过。

### Share + ShareSheet

发分享有两条路径:

- **`Share.openSheet(payload, options?)`(推荐)** — 命令式拉起分享面板。`payload` 是判别联合 `{ type: 'text' | 'image' | 'link', ... }`。**取消 / 失败都 reject(抛 `UmengError`),只有成功才 resolve(`r.code === 'success'`)** —— 必须 try/catch。
- **底层 `shareText` / `shareImage` / `shareLink`** — 跳过面板,直接发到指定 `platform`(必传);面板的 cell 点击内部也是调这三个。

**ShareSheet = 模块级单例 controller + Host 组件**(host + 单例注册表的模式与 design 的 `toast()` / `confirm()` 同源):

- **实现** — `shareSheetController`(`ShareSheet/ShareSheetController.ts`)登记 Host,并用递增 `sessionId`、owner Host 与 `loadingPlatforms → ready → sharing` phase 管理 pending Promise。最早登记的 Host 接收 session;迟到事件只允许结算匹配的 session,owner 卸载会 reject,分享开始后 dismiss 不再抢先结算。
- **UI** — `<ShareSheetHost />` 订阅 controller,用 RN `Modal`(transparent + slide)+ design 的 `Cell` 渲染面板。
- **宿主装配**(`ShareSheetHost.tsx` 自绘面板,靠 design + gesture-handler,易漏):
  - **ThemeProvider** — 用 design 的 `Cell` / `Button` / `useThemedStyles`(+ `ColorTokens` 类型)+ RN `Modal`(`PlatformLeading` 用 design 的 `useTheme`),**需在 design 的 `ThemeProvider` 内渲染**。
  - **GestureHandlerRootView** — Modal 内容已由 `ShareSheetHost` 内部包一层 `GestureHandlerRootView`;App 外层仍可按 RN 通用装配保留 root,但不能把外层写成 Host 生效的硬前提,也不能删除 Modal 内这一层。
  - **平台前导块** — `PlatformLeading` / `WeChatGlyph` / `DingTalkGlyph` 是面板里平台前导小块(品牌色取自 `PLATFORM_BRAND_COLORS`)。

> **Host 必须在 app 根挂一次,且一次只能开一个 sheet。**
> 没挂 Host、已有 session 未结束时重入,或 owner Host 在处理中卸载,都会 reject。不要绕过 controller 自建第二套 pending 状态。

> **`Platform` 是分享目标枚举(`wechat_session` / `dingtalk`),不是 RN 的 `Platform` —— 它没有 `.OS`。**
> 判 OS 用 `react-native` 的 `Platform`。

### Analytics

`onEvent` / `signIn` / `signOut` 都是**同步 void,无 Promise,不要 await**。`onEvent` 的 params 里 number 会自动 `String()`(友盟 iOS attributes 强制 `NSString`)。

### 原生 setup(消费者侧,易漏)

分享回调能不能跳回 App 全靠原生注册,**模板别凭记忆编**,以文档站 / `llms-full.txt` 为准:

- **iOS**
  - `Info.plist` — `LSApplicationQueriesSchemes`(weixin/dingtalk 等 scheme 白名单)+ `CFBundleURLTypes`。回调 URL 值使用微信 App ID 与钉钉 AppKey / Client ID **原值**,不得额外拼 `wx` 或 `dingoa` 前缀。
  - **整改目标** — Pod module map 稳定后显式 `import ReactNativeUmeng`;AppDelegate / SceneDelegate 的 URL 与 Universal Link 入口同时执行 `RCTLinkingManager` 和 Umeng handler,最后 OR 两个结果,不得用短路表达式漏掉第二个 handler。AASA 必须无重定向,`appID = TeamID.BundleID`,path / domain 与 `wechatUniversalLink` 一致。当前 iOS native contract 未通过,这些不能写成已验收能力。
- **Android**
  - Activity 位置 — `WXEntryActivity`(超类 `WXCallbackActivity`)/ `DDShareActivity` **必须在宿主包名下**(微信/钉钉 SDK 反射查 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"`,不能放 library 包)。
  - Activity 只继承 SDK 回调基类:`WXEntryActivity : WXCallbackActivity()`、`DDShareActivity : DingCallBack()`;**不要在 Activity 硬编码 appId**。凭据只从 `Common.preInit(config)` 的快照进入授权后的 native 初始化。
  - 宿主 compile classpath — 微信显式声明 `share-wx` + `wechat-sdk-android`,钉钉显式声明 `share-dingding` + `ddsharesdk`;版本与 library 对齐。当前友盟 `7.3.7` AAR 仍要求 `android.enableJetifier=true`,AGP 10 前必须升级 / 移除并重新验证。
  - 自动合并 — 权限 / `<queries>`、窄 `umeng_cache` FileProvider、默认 disabled 的 callback Activity 与 consumer proguard 由 library 合并;授权初始化成功后才动态启用已配置平台。R8 仍以真实 release minify build 验证,不得口头保证永不 crash。
  - 撤回同意 — 内部 `disableAll()` 可禁用 callback components,但当前没有公共 revoke API;支持撤回的产品需补受控 native 入口并安排进程重启,不得只清 JS 状态后声称 vendor 已反初始化。

### 测试

- Jest 测试放在 `src/__tests__/`,覆盖 JS 逻辑与 React 组件行为(参数校验、初始化状态、ShareSheet session / Host、mock、公共 API 与类型常量)。
- Android JVM 测试放在 `android/src/test/`,覆盖 bootstrap 状态机、callback component 与 module callback 一次性结算。真实微信 / 钉钉 SDK 回跳和 iOS 集成仍需真机验证。
- jest 用 `@react-native/jest-preset`(默认),`passWithNoTests: true`,忽略 `example/node_modules` 与 `lib/`。
- **随包提供官方 mock**(`src/mock.ts`,导出 `./mock`)。消费者整包替换:`jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'))`。`share*` 默认 resolve 成功;`shareSuccess(...)` 可配 `mockResolvedValueOnce`,而 `shareCancel(...)` / `shareFailed(...)` 返回 `UmengError`,必须配 `mockRejectedValueOnce`。`ShareSheetHost` 渲染 `null`(不引 design)。改 `src/` 公共 API 时同步改 mock。

### 真机验证

模拟器没有真微信 / 钉钉,**不能真分享**(iOS UMShare 在 Apple Silicon 模拟器还有 `EXCLUDED_ARCHS=arm64` 限制)。分享改动一律真机验证 —— 这是预期行为,不是 bug。

### 构建(`react-native-builder-bob`)

`yarn prepare` 输出到 `lib/`:`lib/module`(ESM,`esm: true`)+ `lib/typescript`(`.d.ts`,用 `tsconfig.build.json`)。`package.json#exports` 把 `.` 映射到 `source: src/index.ts`(workspace 消费者直读源码)+ `default: lib/module/index.js` + `types`;`./mock` 同理。不要破坏这两组三元组。

## 关键坑(踩过的)

接入 / 改动时最容易踩的,按高频排序:

- **把 cancel/failure 当 resolve** —— `Share.openSheet` / `share*` 取消、失败都 **reject**(`UmengError`,code `E_USER_CANCEL` / `E_SHARE_FAILED`),resolve 到手的 `r.code` 必为 `'success'`。永远 try/catch,别 `if (r.code === 'cancel')`(到不了)。
- **`init` 带参** —— config 只给 `preInit`,`init()` **无参**。没先 `preInit` 直接 `init` 会 reject。
- **没挂 `<ShareSheetHost />`** —— `openSheet` 立即 reject(`No <ShareSheetHost /> mounted`)。根上挂一次,且一次只能开一个 sheet。
- **把 umeng 的 `Platform` 当成 RN 的** —— 它是分享目标枚举,没有 `.OS`。判 OS 用 `react-native` 的 `Platform`;混用时给一个起别名。
- **`Analytics.*` 去 await** —— 它们是同步 void,await 一个 `undefined` 没意义。

## 仓库内注释风格

现有代码用中文记录非显而易见决策的 **why** —— 比如为什么 number attribute 要 `String()`、为什么 cancel 要 reject 而非 resolve、为什么 Activity 不硬编码 appId / 凭据只在授权后的 `init` 跨 native 边界、为什么 init promise 要模块级缓存。保持这个标准:能不写注释就不写,但当读者会想"为什么要这样写"时,就写一句把 why 讲清楚。
