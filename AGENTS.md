# AGENTS.md
<!-- BEGIN UNIF REACT NATIVE STANDARD -->

## 组织共享开发流程

你维护的仓库是 `react-native-umeng`。本区块定义共享门禁;仓库正文只保存本仓特有规则,且只能补充或收紧共享规则。真实冲突必须如实报告,不得静默选择任一规则。

## 任务开始: Skill 发现 + Git 状态 + 分支

- 先查找适用的 Skill 并阅读其说明,再执行任务。
- 开始前运行 `git status --short --branch`,确认工作区和分支状态。
- 若当前位于 `main`,必须在任何修改前创建并切换到语义明确的任务分支;若已位于与任务匹配的非 `main` 分支,继续在该分支工作并保留既有改动。
- 不得混入、覆盖、暂存或提交无关改动。
- `main` 是合并门禁分支: 禁止直接推送 `main`,所有改动必须经 PR 和 CI 进入 `main`。

## 实现与交付: 验证 + PR CI + 合并后自动发布

- 实现后运行仓库特有验证,并使用 conventional commit 提交。
- 推送任务分支并创建 PR;PR CI 通过后再合入 `main`。
- 命中 release workflow 路径的改动会在合入后自动发布。除任务明确要求人工应急发布外,不得手工改版本、创建 tag 或执行 `npm publish`。

## website / llms.txt / umeng-share Skill 联动

- 每次库改动都必须核对 `website`、`llms.txt` 和 `../skills/skills/umeng-share/` 中对应的 `umeng-share` Skill。
- 明确核对公共 API、类型、运行时行为、错误语义、依赖 / 安装、原生配置、mock、消费者示例、排障结论和文档入口。
- 受影响项与本次交付同步更新;不受影响时说明核对范围与理由;不可访问或不可写时如实报告。

## RNGH 3 / Carousel 5 条件化窄例外

- 仅当仓库实际采用 `@unif/react-native-design@0.20.0`、`react-native-gesture-handler >=3 <4` 和 `react-native-reanimated-carousel@5.0.0` 时适用;该规则不要求未采用此组合的仓库升级依赖。
- Carousel 发布 metadata 的 RNGH 范围为 `>=2.9 <3`,与 Design 的 RNGH 范围无交集,但当前组合已适配并验证。
- 不得仅凭 warning 再次询问、阻塞或建议降级;保留 scoped override、窄 allowlist 和严格漂移检查,禁止全局 override、`--force`、`--legacy-peer-deps`。
- 仅在可复现相关回归,或 Carousel 版本 / peer range / RNGH major 变化时重评。

## 共享与本仓规则边界

本区块外的内容属于本仓规则,同步时必须保留。模板已有的通用规则不得在仓库正文重复。

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
yarn test             # jest(跑 src/__tests__/ 下的纯 JS 逻辑测试)
yarn test src/__tests__/share.test.ts    # 跑单文件
yarn test -t "pattern"                    # 按测试名过滤
yarn prepare          # react-native-builder-bob → lib/module(ESM)+ lib/typescript
yarn clean            # 清 lib/ + example 构建产物

# example 应用(真机验证分享,见下)
yarn example start    # metro
yarn example ios      # 构建并跑 iOS
yarn example android  # 构建并跑 Android
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
  - 行为 — 存 config + 注册微信/钉钉平台(`PlatformConfig.setWeixin/setDing`),**不上报**。
- **`Common.init()`** — 用户同意后调,**无参**(config 已给 preInit),真正调 `UMConfigure.init` 开始采集。
  - 例外 — 没先 `preInit` 直接 `init` 会 reject。

`preInit` 的 config 字段:

| 字段 | 必填 |
| --- | --- |
| `appkey` | 必填 |
| `channel` / `wechatAppId` / `wechatAppSecret` / `wechatUniversalLink` / `dingtalkAppId` | 可选 |

> **两个方法都 idempotent。**
> 模块级 `preInitPromise` / `initPromise` 缓存 → 重复调只触发一次;native 侧 `UmengBootstrap` 用 `@Volatile` flag 双重保险。

### Share + ShareSheet

发分享有两条路径:

- **`Share.openSheet(payload, options?)`(推荐)** — 命令式拉起分享面板。`payload` 是判别联合 `{ type: 'text' | 'image' | 'link', ... }`。**取消 / 失败都 reject(抛 `UmengError`),只有成功才 resolve(`r.code === 'success'`)** —— 必须 try/catch。
- **底层 `shareText` / `shareImage` / `shareLink`** — 跳过面板,直接发到指定 `platform`(必传);面板的 cell 点击内部也是调这三个。

**ShareSheet = 模块级单例 controller + Host 组件**(host + 单例注册表的模式与 design 的 `toast()` / `confirm()` 同源):

- **实现** — `shareSheetController`(`ShareSheet/ShareSheetController.ts`)持有 pending Promise;`openSheet` 调 `controller.show()` emit 事件,`<ShareSheetHost />`(订阅 controller)用 RN `Modal`(transparent + slide,替代原 @gorhom `BottomSheet`)+ design 的 `Cell` 渲染面板。
- **宿主装配**(`ShareSheetHost.tsx` 自绘面板,靠 design + gesture-handler,易漏):
  - **ThemeProvider** — 用 design 的 `Cell` / `Button` / `useThemedStyles`(+ `ColorTokens` 类型)+ RN `Modal`(`PlatformLeading` 用 design 的 `useTheme`),**需在 design 的 `ThemeProvider` 内渲染**。
  - **GestureHandlerRootView** — `Cell` / `Button` 内部用 `react-native-gesture-handler` 的 `Pressable`,故宿主仍要 **`GestureHandlerRootView` 包裹**。
  - **平台前导块** — `PlatformLeading` / `WeChatGlyph` / `DingTalkGlyph` 是面板里平台前导小块(品牌色取自 `PLATFORM_BRAND_COLORS`)。

> **Host 必须在 app 根挂一次,且一次只能开一个 sheet。**
> 没挂 Host → `openSheet` 立即 reject;已有 sheet 未关时重入 → 直接 reject。

> **`Platform` 是分享目标枚举(`wechat_session` / `dingtalk`),不是 RN 的 `Platform` —— 它没有 `.OS`。**
> 判 OS 用 `react-native` 的 `Platform`。

### Analytics

`onEvent` / `signIn` / `signOut` 都是**同步 void,无 Promise,不要 await**。`onEvent` 的 params 里 number 会自动 `String()`(友盟 iOS attributes 强制 `NSString`)。

### 原生 setup(消费者侧,易漏)

分享回调能不能跳回 App 全靠原生注册,**模板别凭记忆编**,以文档站 / `llms-full.txt` 为准:

- **iOS**
  - `Info.plist` — `LSApplicationQueriesSchemes`(weixin/dingtalk 等 scheme 白名单)+ `CFBundleURLTypes`(回调 scheme:`wx`+appid、`dingoa`+appid)。
  - `AppDelegate` — 把 `open url` / `continue userActivity` 转发给桥导出的 `UmengBootstrap`。注意方法名是 **`handleOpen(_:options:)`**(Swift omit-needless-words),不是 `handleOpenURL`。
- **Android**
  - Activity 位置 — `WXEntryActivity`(超类 `WXCallbackActivity`)/ `DDShareActivity` **必须在宿主包名下**(微信/钉钉 SDK 反射查 `getPackageName() + ".wxapi.WXEntryActivity"` / `+ ".ddshare.DDShareActivity"`,不能放 library 包)。
  - 钉钉 `appId` — 在 Activity `onCreate` 写死,要和 JS `preInit({ dingtalkAppId })` 一致(推荐 `BuildConfig.DINGTALK_APPID` 单一数据源)。
  - 自动合并 — 权限 / `<queries>` / consumer proguard 由 library Manifest + `consumer-rules.pro` 自动合并,宿主不用写。

### 测试

- 测试 colocate 在 `src/__tests__/`,只覆盖**纯 JS 逻辑**(参数校验、reject-on-cancel、controller 单例、mock、类型常量)。**原生桥不在这里测**(需真机)。
- jest 用 `@react-native/jest-preset`(默认),`passWithNoTests: true`,忽略 `example/node_modules` 与 `lib/`。
- **随包提供官方 mock**(`src/mock.ts`,导出 `./mock`)。消费者整包替换:`jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'))`。`share*` 默认 resolve 成功,`shareSuccess/shareCancel/shareFailed` 助手 + `mockResolvedValueOnce` 覆盖单次;`ShareSheetHost` 渲染 `null`(不引 design)。改 `src/` 公共 API 时同步改 mock。

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

## 文档与 skill 同步

改了组件 / API / 类型,或想知道「消费者怎么接这个库」时看这里。

- **API / props / 类型全量** → 文档站 + 远程 llms.txt(按需 fetch,**不在本仓镜像**):
  - 文档站:<https://unif-design.github.io/react-native-umeng/>
  - llms 索引:<https://unif-design.github.io/react-native-umeng/llms.txt>
  - llms 全文:<https://unif-design.github.io/react-native-umeng/llms-full.txt>
- **website docs 是 llms.txt 的唯一来源** —— 改了组件 / API / 类型,**同步改 `website/docs/`**(Docusaurus,中文;AI 读的是它,不是源码注释)再 `node website/scripts/build-llms.js` 重生成,否则 AI 读到的会过时。
- **消费侧 skill 精确映射** —— `umeng-share` 位于 sibling `unif-design/skills` 仓的 `../skills/skills/umeng-share/`;逐项核对 `SKILL.md`、`references/`、`assets/`、`scripts/` 与 `metadata.version`。手写的快速开始、核心模式、易错点、测试和模板需要按实际变更同步;全量 API 继续路由到远程 llms.txt。

## 仓库内注释风格

现有代码用中文记录非显而易见决策的 **why** —— 比如为什么 number attribute 要 `String()`、为什么 cancel 要 reject 而非 resolve、为什么钉钉 appId 只能 native 侧拿、为什么 init promise 要模块级缓存。保持这个标准:能不写注释就不写,但当读者会想"为什么要这样写"时,就写一句把 why 讲清楚。
