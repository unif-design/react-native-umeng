# Umeng Example 合规初始化与分享展厅设计

日期：2026-08-03
状态：已批准，待实施

## 1. 背景与现状问题

当前 `example/src/App.tsx` 是单文件验证页：凭据以源码常量占位、界面混用 RN
原生按钮与硬编码颜色、功能按长页面堆叠，只覆盖一种直发组合。它能验证基础接线，
但不适合作为产品化演示，也不能安全复制到消费者 App。平台安装状态、分享参数、
错误分级和初始化恢复边界都缺少清晰呈现，README 还要求直接修改源码中的配置。
此外，根开发图与 example 当前使用 RN 0.85.3，不满足
`@unif/react-native-design@0.20.0` 的 RN `>=0.86.0 <0.87.0` 运行基线。

本设计把 example 改造成独立、产品化且可复制的“合规初始化与分享展厅”。它只消费
`@unif/react-native-umeng` 当前公开 API，既展示正确接入方式，也作为双端原生接线和
自动化测试的集成宿主。

## 2. 目标

- 用可操作流程展示 `preInit → 明示同意 → init`，授权前保持零 vendor SDK 调用。
- 完整展示平台检测、分享面板、两平台三内容直发、Analytics 和错误语义。
- 凭据只存在运行时内存；仓库、日志、测试快照和持久存储均不保存 secret。
- UI 全部复用 `@unif/react-native-design`，支持主题、动态字号和 a11y。
- example 目录可复制到消费者工程，并由 README 说明依赖与原生配置。
- 保持现有 native contract、Android JVM、iOS XCTest 和 minified release 门禁。

## 3. 范围与非范围

范围包括 example 的 JS/TS 页面与测试、README、必要的 iOS/Android 宿主配置清理，
根开发图与 example 的 RN 0.86.2 依赖升级、锁文件更新，以及 CI 对 example 测试的
接入；同时更新根 `AGENTS.md` 和 README 中的当前开发验证基线，不改变 Umeng 公共
React/RN peer contract。

非范围：

- 不修改 umeng 公共 API、类型、错误码、mock 或 native bridge 契约。
- 不增加朋友圈、QQ、微博或新的分享内容类型。
- 不引入 React Navigation、外部状态库或跨仓共享包。
- 不保存用户同意状态、凭据、日志或表单内容；App 重启后一律重新开始。
- 不承诺模拟器能完成真实微信/钉钉拉起、回包或 Universal Link 验收。

### 3.1 运行版本与依赖边界

`@unif/react-native-design@0.20.0` 的运行 contract 是
`react-native >=0.86.0 <0.87.0` 与 `react >=19.2.3 <20.0.0`。不能继续用 RN 0.85.3
或忽略 peer warning。实现时把根 `devDependencies` 与 example 原生运行图固定到以下
同一基线，并更新 `yarn.lock`：

| 位置 | 版本要求 |
| --- | --- |
| 根与 example 的 `react-native` | `0.86.2` |
| 根与 example 的 `react` / `react-test-renderer` | `19.2.3` |
| 根 `@react-native/{babel-preset,eslint-config,jest-preset,metro-config}` | `0.86.2` |
| example `@react-native/{babel-preset,jest-preset,metro-config,typescript-config}` | `0.86.2` |
| example `@react-native-community/{cli,cli-platform-android,cli-platform-ios}` | `20.1.0` |

CLI 20.1.0 与 React 19.2.3 已和 RN 0.86.2 官方模板一致；不是为了升级而追最新 major。
对照 0.85.3 → 0.86.2 官方模板复核 Android/iOS 工程文件，更新 CocoaPods 锁定结果，
但保留本仓 Umeng callback、测试 target、R8 和双回调接线。Umeng 发布包的
`peerDependencies`（包括 `react: "*"`、`react-native: "*"`）、公开 API、Codegen
schema 与 native bridge contract 本轮均不改变。

Design 0.20 组合仍有一个已知窄例外：
`react-native-reanimated-carousel@5.0.0` 发布的 RNGH peer 为 `>=2.9.0 <3.0.0`，
而本仓锁定验证的是 `react-native-gesture-handler@3.1.0`。只能保留
`scripts/verify-dependencies.mjs` 中精确到包名、版本、peer 名、peer range 和安装版本的
scoped allowlist，并让版本漂移直接失败；禁止 `--force`、`--legacy-peer-deps`、全局
override 或为消除 warning 降级 RNGH。

## 4. 信息架构与模块边界

example 使用本地 typed navigation。`RouteId` 是封闭联合：
`setup | home | platforms | sheet | direct | analytics | logs`。导航 reducer 维护只读
route stack，提供 `navigate/back/reset`；页面注册表是 `Record<RouteId, Screen>`，
编译期保证路由与页面一一对应。首页用 design `Grid`/`EntryCard` 进入各模块，子页用
`NavBar` 返回，不实现 deep link、手势路由或持久化。

建议拆分：

```text
example/src/
  App.tsx                         # 根 Provider、ShowcaseProvider、ShareSheetHost
  navigation.ts                   # RouteId、stack reducer、screen registry
  state/showcaseState.ts          # 初始化、平台、日志与当前配置快照
  screens/SetupScreen.tsx
  screens/HomeScreen.tsx
  screens/PlatformsScreen.tsx
  screens/SheetScreen.tsx
  screens/DirectShareScreen.tsx
  screens/AnalyticsScreen.tsx
  screens/LogsScreen.tsx
  components/CredentialForm.tsx
  components/SharePayloadEditor.tsx
  components/OperationFeedback.tsx
  content/shareContent.ts          # 可编辑的默认 HTTPS 素材
  errors/classifyUmengError.ts
  __tests__/...
```

`App.tsx` 根结构固定为
`GestureHandlerRootView > ThemeProvider > ShowcaseProvider > Screen + ShareSheetHost`。
`ShareSheetHost` 在根上只挂一次、位于 `ThemeProvider` 内；其 Modal 内部已有自己的
RNGH root。业务模块不得自行创建第二个 Host。

所有 design 组件只从包根导入。表单优先使用 `Form/Input/PasswordInput/Switch`，
选择使用 `Segmented`，状态使用 `Tag/StatusDot`，动作使用 `Button/IconButton`。
颜色走 `useColors()`，样式走模块顶层 `makeStyles` + `useThemedStyles()`；不新增
硬编码颜色，不用 `Pressable + Text` 重造已有控件。所有 icon-only 操作提供
`accessibilityLabel`。

## 5. 凭据与配置生命周期

Setup 页提供运行时内存表单：`appkey`、可选 `channel`、微信启用开关及
`wechatAppId/wechatAppSecret/wechatUniversalLink`、钉钉启用开关及
`dingtalkAppId`。secret 使用 `PasswordInput`。字段初值为空，提示文字只放在
placeholder；任何 `YOUR_...` 示例值也按占位值拒绝。

点击“预初始化”前执行以下校验：

- `appkey` 必填。
- 微信启用时两端都要求 App ID + secret；iOS 还要求带 host 的绝对 HTTPS
  Universal Link。Android 不要求 Universal Link，但一旦填写也必须是带 host 的绝对
  HTTPS URL。
- 钉钉是公开配置中的可选平台；展厅开关启用时，本地要求 `dingtalkAppId`。
- 可选字段一旦填写，trim 后不得为空。

公开 validator 以“任一微信字段存在”判断微信已启用，因此开关关闭时构造 config 必须
完全省略三项微信字段；钉钉关闭时省略 `dingtalkAppId`。展厅额外拒绝 `YOUR_...`
占位值，这是示例的安全策略，不宣称是库 validator 的新增规则。

缺项或占位值只显示字段错误，绝不调用 `Common.preInit`。调用成功后保存一份仅在
内存中的不可变快照并锁定全部配置控件；日志只记录字段是否配置，不记录字段值。
锁定后不提供“解锁”或内部 reset，换凭据必须重启 App，避免示例暗示 native 启动后
可以安全换配置。这是展厅比公开 API 更保守的产品策略；公开 JS contract 在 native
尚未开始前允许用不同配置再次 `preInit`，但展厅不暴露该路径。

## 6. 合规初始化状态机

```text
editing
  -> preInitializing
  -> awaitingConsent
  -> initializing
  -> initialized

preInitializing --校验/preInit失败--> editing
awaitingConsent --未勾选同意-------> awaitingConsent
initializing --失败---------------> initFailedLocked
initFailedLocked --同配置重试------> initializing
```

`Common.preInit(config)` 只由 Setup 页按钮触发，成功前不展示同意操作。隐私同意框
默认未选中；只有用户主动勾选并点击“同意并初始化”才调用无参 `Common.init()`。
拒绝或暂不同意不调用 native，仍停留在等待状态。

恢复边界必须写进 UI：

- 表单校验和 `preInit` 失败发生在 native 启动前，可编辑后重试。
- `init` 开始后配置永久锁定；JS 会在 rejection 后清除 in-flight promise，因此 UI
  可以用同一快照再次调用 `Common.init()`，但不能承诺 native 一定可恢复。
- Android vendor/callback 阶段抛错会进入稳定的 terminal state，后续同配置调用仍返回
  需重启错误。iOS 明确的平台注册返回失败可以从已到达阶段同配置重试；vendor exception
  则同样 terminal。example 不解析 `nativeError` 私有 shape、不声称已回滚；UI 同时提供
  同配置重试和重启说明，重复稳定失败后以重启为准。
- 分享、平台查询等初始化后的单次操作失败不改变初始化状态，可以原操作重试。

## 7. 平台状态

初始化成功后自动调用 `Share.listPlatforms()`，展示微信与钉钉的
`installed/displayName`；“刷新全部”再次调用该 API。每个平台另有“重新检测”按钮，
调用 `Share.isInstalled(platform)`，用于演示单平台查询。初始化前所有查询禁用，
查询失败保留上一次可信状态并展示错误，不把失败伪装成“未安装”。
调用签名保持 `listPlatforms(): Promise<PlatformInfo[]>` 与
`isInstalled(platform): Promise<boolean>`；`listPlatforms` 的任一底层查询失败会整体
reject，不自行把该平台改写为 `installed: false`。

## 8. 分享能力

### 8.1 素材

`content/shareContent.ts` 集中提供可编辑默认值。链接默认使用
`https://unif-design.github.io/react-native-umeng/`，图片与缩略图默认使用
`https://unif-design.github.io/react-native-umeng/img/logo.png`。页面允许编辑文本、
标题、描述和 URL；图片类字段在提交前强制绝对 HTTPS，并显示预览加载状态。
预览加载失败属于可恢复网络错误，阻止本次分享但不改变初始化状态。

默认图片由仓库内 `website/static/img/logo.png` 提供，并已对应 Docusaurus 的
`baseUrl=/react-native-umeng/`；实现验收仍要对部署 URL 做 200 + `image/png` 检查。
远端可用性不能由源码永久保证，所以 URL 必须保持可编辑，预览只作为本次网络预检，
不承诺 vendor SDK 随后一定下载成功。库公开 validator 接受带 host 的绝对 HTTP 或
HTTPS URL；强制 HTTPS 是展厅的本地安全策略，不得写成 Umeng API 限制。

### 8.2 `openSheet`

Sheet 页用 `Segmented` 切换 `text/image/link`，分别编辑公开 payload 的全部字段。
“面板选项”区域覆盖 `title`、`cancelText`、微信/钉钉 `subtitles` 和
`hideUninstalled`。提交时原样调用 `Share.openSheet(payload, options)`，不复制
ShareSheet 内部状态，也不自行筛选平台。调用签名固定为
`openSheet(payload: ShareSheetPayload, options?: ShareSheetOptions): Promise<ShareResult>`；
text/image/link payload 分别覆盖 `text`、`image/thumb?`、
`title/url/description?/thumb?`，options 不增加私有字段。

### 8.3 直发矩阵

Direct 页呈现微信会话、钉钉两行，与 text、image、link 三列，共六个动作：
`shareText/shareImage/shareLink × Platform.WECHAT_SESSION/Platform.DINGTALK`。
共用同一份可编辑素材。初始化前禁用；已知未安装平台显示状态并禁用对应行，状态未知或
过期时先重新检测。成功只展示 `success@platform`，取消和失败走统一错误分类。

## 9. 错误、反馈与日志

统一 `classifyUmengError`：

- `E_USER_CANCEL` 为中性结果，文案“已取消分享”，不用错误色、不弹失败提示。
- `E_PLATFORM_NOT_INSTALLED`、一般操作中的 `E_INVALID_OPTIONS`、`E_NOT_INITIALIZED`
  为可操作警告，分别引导安装平台、修正输入或完成初始化；若
  `E_INVALID_OPTIONS` 表示 native 启动后试图换配置，则必须提示重启，不能声称修改表单
  即可恢复。
- `E_SHARE_FAILED` 为本次操作失败，可重试。
- `E_PLATFORM_NOT_SUPPORTED`、`E_UNKNOWN` 和非 `UmengError` 为严重诊断错误；
  若发生在 init 阶段，同时展示同配置重试与重启说明。

公开 `ErrorCode` 联合和错误归一化白名单确实包含全部七项：
`E_PLATFORM_NOT_INSTALLED`、`E_PLATFORM_NOT_SUPPORTED`、`E_INVALID_OPTIONS`、
`E_USER_CANCEL`、`E_SHARE_FAILED`、`E_NOT_INITIALIZED`、`E_UNKNOWN`。前三项不是展厅
自造文案：未安装平台可由 ShareSheet/iOS native 产生，不支持平台与非法参数可由公开
JS validator 产生。测试必须逐项覆盖公开 code；不要依赖 Android 将所有未安装场景都
精确映射为 `E_PLATFORM_NOT_INSTALLED`。

日志项为 `{id, timestamp, level, scope, message}`，使用本地时间到毫秒，最新在前并设置
有界数量。日志页提供 design 按钮清空；正文使用 RN `Text selectable`，便于复制诊断。
不得记录 appkey、secret、App ID、用户分享正文或完整 URL。清空只清 UI 内存，不影响
SDK 状态。

Analytics 页覆盖 `onEvent/signIn/signOut`。三者是同步 `void`；调用后日志只能写
“JS 已调用 Analytics.onEvent”等事实，禁止写“上报成功”“服务端已收到”或 `await`。
该日志只在同步调用正常返回后追加；同步抛出的 `E_INVALID_OPTIONS` 走统一分类，不能
同时写“JS 已调用”。

## 10. 原生宿主配置

iOS `Info.plist` 保留 URL Types 占位，但微信 scheme 改为登记原值占位
`YOUR_WECHAT_APP_ID`，钉钉改为 `YOUR_DINGTALK_APP_KEY_OR_CLIENT_ID`；不得添加
`wx` 或 `dingoa` 前缀。真实值由开发者按 README 在本地替换，不提交 secret。

`AppDelegate.swift` 与 Scene lifecycle fixture 继续分别调用 Umeng handler 和
`RCTLinkingManager`，先保存两个结果再 OR；禁止用短路表达式导致其中一路未执行。
Universal Link、Associated Domain 与 AASA 的真实闭环仍由真机验收。

Android 从 example `AndroidManifest.xml` 删除重复的 `WXEntryActivity` 和
`DDShareActivity` 节点，依赖 library manifest merger 提供 disabled 声明；必须保留
宿主包名下两个 Kotlin 回调类，以及 `share-wx/wechat-sdk-android`、
`share-dingding/ddsharesdk` compile dependencies。merged manifest 门禁继续确认
最终类名、disabled 状态和 FileProvider。

## 11. README 与可复制性

README 按“安装依赖 → 运行时填写凭据 → 明示同意 → 平台检测 → 分享验证 → 原生回调
配置 → 测试矩阵”组织。明确仓库不存真实凭据、表单不持久化、iOS scheme 使用登记原值、
Android 回调类必须位于最终宿主包名、图片只支持网络 HTTPS，以及模拟器/真机证据边界。
这里必须区分“库接受绝对 HTTP/HTTPS 网络 URL”和“展厅默认只放行 HTTPS”的本地策略。
复制指南只引用 npm 包公开入口和 example 内文件，不依赖根仓内部模块。根 README 与
`AGENTS.md` 将“目标运行时 RN 0.85”收敛为“公共 peer 保持原值、仓库当前在 RN 0.86.2
开发和验证”，避免后续维护继续生成不满足 Design 0.20 contract 的宿主。

## 12. 测试与验证矩阵

example Jest 使用官方
`jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'))`，
不手写模块 stub。example 自己声明 `test` script，以及 Jest、
`react-test-renderer@19.2.3`、Testing Library 和所需 types，不能仅依赖根 Jest
恰好 hoist；CI 在现有根 `yarn test --maxWorkers=2 --coverage` 之外明确执行
`yarn example test --maxWorkers=2`，因为根 Jest 当前忽略 `example/`。测试覆盖：

- 缺项/占位值阻止 `preInit`，有效配置精确传入且 secret 不进入日志。
- `preInit` 成功后锁定、未明示同意不调 `init`、同意后 `init()` 无参。
- 初始化状态转换、同配置重试、平台查询成功/失败及旧状态保留。
- 三类 openSheet payload、全部 options 和两平台三内容直发参数。
- `shareCancel` 产生中性反馈，`shareFailed` 与各 `UmengError` code 正确分级。
- Analytics 为同步调用，日志只断言“JS 已调用”；日志可清空且正文 selectable。

继续运行并不得削弱现有门禁：JS typecheck/lint/Jest/prepare、Android native contract、
JVM tests、release merged manifest、启用 R8 的 minified release、iOS native
contract、XCTest、module provider 和 simulator build。

最终真机矩阵覆盖 iOS/Android × 微信/钉钉 × text/image/link，并验证成功、用户取消、
未安装、真实回包；iOS 另验证 URL Scheme、Universal Link 与线上 AASA。自动化结果不得
替代真机矩阵。

## 13. 验收标准

- App 启动不自动调用 `preInit/init`，仓库无真实凭据或 secret。
- 只有有效表单可 `preInit`；成功即锁定；只有未预选的明示同意可触发无参 `init`。
- `listPlatforms/isInstalled`、三类 openSheet/options、六项直发和三项 Analytics
  均可从独立页面操作。
- `E_USER_CANCEL` 中性展示，其余错误按本规格分级；所有日志有时间、可选中、可清空且
  不泄露凭据或分享内容。
- UI 只用 design 组件和 token，无 React Navigation、跨仓共享包或 umeng API 变更。
- iOS 双路回调不短路且 scheme 占位无额外前缀；Android 无重复 Activity 节点但回调类、
  compile dependencies 与 merged manifest 结果完整。
- README 足以指导复制、运行、原生配置和真机验收。
- example mock 测试及既有 JS、native、JVM、XCTest、minified build 门禁全部通过。
- 根开发图与 example 运行在 RN 0.86.2/React 19.2.3，匹配的 RN preset/config 为
  0.86.2、CLI 为 20.1.0；Umeng 公共 peer/API 未变，Carousel/RNGH 只保留精确 scoped
  例外。
- 根 README 与 `AGENTS.md` 已准确记录 RN 0.86.2 当前验证基线和未收紧的公共
  React/RN peer 范围。
