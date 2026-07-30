# react-native-umeng 全仓审查一次性修复设计

> 日期：2026-07-30  
> 状态：已确认设计，等待书面规格复核  
> 范围：`@unif/react-native-umeng` 的 JS、ShareSheet、Android、iOS、example、website、CI 与发布链路

## 1. 背景与目标

本轮对仓库全部代码和配置进行了审查，并按用户要求在确定修复方案前核对了 React Native、Android、Apple、Babel、Yarn、Turborepo、Reanimated、Gesture Handler、友盟、微信与钉钉的一手资料。

审查发现的问题不是单个缺陷，而是同一发布链路上的一组关联风险：

- 当前源码和构建产物使用 Metro 默认 Babel 配置不能解析的命名空间导出语法。
- ShareSheet 存在迟到异步结果串到新会话、Host 卸载后 Promise 永不结束、双击重复分享等竞态。
- Android 和 iOS 的隐私初始化顺序与当前官方合规指引不一致。
- Android 缺 FileProvider、正确回调 Activity、Jetifier 说明和准确的 R8 规则。
- iOS 的 Universal Link 配置顺序、主线程要求、Codegen 注册、Swift module 与回调转发不完整。
- example、website 和 CI 没有真实覆盖消费者需要的依赖、Metro bundle、发布压缩包与原生接入配置。
- 文档、首页、llms 产物和发布触发条件与实际 API 或产物存在漂移。

本设计的目标是一次性修复已识别问题，同时保持现有公共能力和视觉体系：

- 保留 `Common`、`Share`、`Analytics`、`ShareSheetHost` 的公共 API 形态。
- 保留基于 `@unif/react-native-design` 的 ShareSheet UI，不在本轮重做视觉组件。
- 用户同意隐私协议前，不调用友盟、微信或钉钉的任何 native SDK API。
- 取消和失败继续 reject；只有分享成功 resolve。
- 所有开发、示例、文档、测试与发布入口使用同一套可验证依赖组合。
- 修复以一个版本交付，但实现计划可以按 JS、Android、iOS、工具链并行，最终统一验证。

本轮不新增分享平台、分享内容类型、授权登录、推送或新的 UI variant。Android SDK 本地构建按用户要求暂不作为本地完成条件，但 Android 代码、配置、静态检查与 CI 验证入口仍必须实现；有 SDK 的 CI 或测试环境随后完成编译和真机验证。

## 2. 已确认的关键决策

| 领域 | 决策 |
| --- | --- |
| 公共 API | 保留 `Common.preInit(config)` 与 `Common.init()` 两段式调用 |
| 隐私边界 | `preInit` 仅在 JS 内校验并缓存配置；授权前零 native SDK 调用 |
| Native 初始化 | 授权后的 `init()` 通过单次内部 `initialize(config)` 执行平台阶段状态机 |
| Design | 全仓统一使用 `"@unif/react-native-design": "^0.20.0"` |
| Reanimated | 包、example、website 和开发环境统一声明 `"react-native-reanimated": "^4.5.3"` |
| Worklets | 包、example、website 和开发环境统一声明 `"react-native-worklets": "^0.11.3"` |
| Design peers | 因 `design@0.20.x` 仍只有根入口并静态导出完整组件树，Umeng 明确声明并在测试工程安装其运行时 peers |
| Bottom Sheet | `design@0.20.x` 已移除 `@gorhom/bottom-sheet` peer；Umeng、example 与文档同步移除它 |
| ShareSheet | 继续使用 RN `Modal`，Modal 内容内部增加 `GestureHandlerRootView` |
| Android SDK | 本机暂不要求 assemble；CI/有 SDK 环境必须补齐 release、merged manifest 与 R8 验证 |
| 交付方式 | 所有已识别问题在同一修复版本完成，不拆成多个用户可见版本 |

截至 2026-07-30，npm 官方 registry 的 `@unif/react-native-design` 最新版本为 `0.20.0`。版本声明统一使用 `^0.20.0`，锁文件记录本次安装实际解析结果。

## 3. 公共初始化模型与隐私边界

### 3.1 对外调用顺序

公共调用方式保持不变：

```ts
await Common.preInit(config); // 仅 JS 校验和缓存，不调用 vendor SDK

// 用户明确同意隐私协议后
await Common.init();
```

数据流调整为：

```text
应用启动
  └─ Common.preInit(config)
       ├─ 运行时校验
       ├─ 保存不可变配置快照
       └─ Promise.resolve()

用户同意隐私协议
  └─ Common.init()
       ├─ NativeUmengCommon.initialize(config)
       │    ├─ native pre-init / 平台配置
       │    └─ 正式 init
       └─ 成功后进入 initialized

用户拒绝隐私协议
  └─ 不调用 Common.init()
       └─ native module 可被框架实例化，但构造无 vendor 副作用，
          且不持有 appkey、不进入友盟/微信/钉钉 SDK
```

`NativeUmengCommon` 将现有 `preInit(config)` 与 `init()` 两个内部 bridge 方法收敛为单个 `initialize(config)`。这是 private Codegen 接口调整，不改变公共 `Common.preInit(config)`/`Common.init()`，但能避免 JS 跨两次 bridge 调用制造不可观察的中间状态。

New Architecture 的 `TurboModuleRegistry.getEnforcing` 和 modules provider 可以解析或实例化 native module，因此合规契约不是“授权前绝不触达 native 代码”，而是“授权前 native module 构造、Package 注册、分享、回调和 Analytics 均不调用任何友盟、微信或钉钉 SDK API”。

### 3.2 JS 状态与幂等

JS 侧维护以下状态：

```text
unconfigured -> configured -> initializing -> initialized
                         \-> retryableFailure -> configured
                         \-> indeterminateFailure -> restartRequired
```

规则如下：

- `preInit` 先完整校验并规范化，再缓存配置；校验失败不写入任何状态。
- 同一份规范化配置重复调用 `preInit` 直接成功。
- 在 `Common.init()` 首次开始前，新的有效配置可以原子替换旧快照；一旦 native 初始化开始，不同配置 reject `E_INVALID_OPTIONS`，更换 appkey 或平台凭据需要重启进程。
- `init` 在没有成功 `preInit` 时 reject `E_NOT_INITIALIZED`。
- 并发 `init` 共享同一个 in-flight Promise。
- `init` 失败时清除 JS in-flight Promise，但是否可重试由 native 阶段状态决定；不能把有副作用的 vendor API 描述成可事务回滚。
- 只有 native `initialize(config)` 完成后才进入 JS `initialized`。
- 已初始化后的 `init` 直接成功，不重复进入 SDK。

配置规范化采用固定字段顺序：

- 所有字符串先 `trim()`，并缓存 trim 后的值；trim 后为空即非法。
- `undefined` 和字段缺失统一为“未提供”；显式 `null` 或其他类型非法。
- `channel` 未提供时仍在快照中记为“未提供”，Android 和 iOS 分别在 native 使用自身默认值。
- 配置相等性按规范化后的固定字段逐一比较，不使用对象引用或 JSON key 顺序。

### 3.3 配置校验

校验在 JS 入口执行，native 端再次防御性校验。要求如下：

- `config` 必须是非空对象。
- `appkey` 必须是非空字符串。
- `channel`、`wechatAppId`、`wechatAppSecret`、`wechatUniversalLink`、`dingtalkAppId` 如果出现，必须是非空字符串。
- 任一微信字段出现即视为启用微信。
- Android 启用微信时必须同时提供 `wechatAppId` 与 `wechatAppSecret`；`wechatUniversalLink` 可以保留在快照中但不参与 Android SDK 调用。
- iOS 启用微信时必须同时提供 `wechatAppId`、`wechatAppSecret` 与 `wechatUniversalLink`。
- iOS `wechatUniversalLink` 必须是带 host 的绝对 HTTPS URL；entitlement/AASA 域名一致性由原生配置检查清单和真机验收确认。
- `wechatUniversalLink` 单独出现或任一组合不完整都 reject。
- 不完整的平台配置直接 reject，不能静默跳过一半字段后缓存成功 Promise。

JS 使用 RN `Platform` 的别名执行平台组合校验，native 端在调用任何 vendor API 前再次验证并比较规范化配置，防止 RN reload 绕过 JS 状态。

Native 初始化采用明确阶段：

```text
notStarted
  -> preInitialized
  -> platformsConfigured
  -> initialized
  \-> indeterminateFailure
```

- “调用成功”只表示同步 API 返回且没有抛出异常；`UMConfigure.preInit/init` 等 `void` API 不提供 SDK 内部成功回执。
- 每个可观察阶段完成后记录阶段，已知阶段之间的失败只从最后完成阶段继续，不重复执行已经完成的步骤。
- 如果 vendor API 抛错后无法判断是否已产生副作用，进入 `indeterminateFailure`；后续调用稳定 reject `E_UNKNOWN` 并提示重启进程，不承诺透明重试或回滚。
- iOS `setPlaform == NO` 视为平台注册失败；已成功的平台单独记录，使用相同规范化配置的重试只处理未完成平台。
- Native 同时只允许一个 initialize 操作；并发调用等待同一结果。
- 发生任何 native 副作用后都不允许切换配置；需要换 appkey/凭据时重启进程。

### 3.4 Analytics 初始化门禁

Android 与 iOS 的 `onEvent`、`signIn`、`signOut` 在 native 端先检查共享 bootstrap 的 `isInited`：

- 未初始化时静默 no-op，保持现有同步 `void` API。
- 已初始化时才进入友盟 Analytics API。

不能依赖友盟 SDK 自己在 init 前吞掉调用，因为锁定 Android AAR 的事件路径会建立 Analytics 内部对象并进入处理链。

### 3.5 Share 与回调门禁

Android 与 iOS 的所有分享 native 入口在取得 `UMShareAPI`/`UMSocialManager` 前检查 bootstrap：

- `shareText`、`shareImage`、`shareLink`、`isInstalled` 在未初始化时 reject `E_NOT_INITIALIZED`。
- `listPlatforms` 传播 `isInstalled` 的初始化错误。
- `openSheet` 在 `loadingPlatforms` 阶段收到该错误后立即结束 session，不显示伪造的“全部未安装”状态。
- 生命周期与 URL 回调在未初始化时跳过友盟 handler；没有 Promise 的入口只返回未处理或记录诊断，不实例化 vendor manager。

iOS 的 AppDelegate 仍始终调用 `RCTLinkingManager`。Umeng handler 在未初始化时返回 `NO`，因此冷启动 URL/Universal Link 会进入 React Native Linking，但不会排队等待友盟初始化。若应用已持久化用户同意状态并要求接住冷启动分享回调，应在宿主 native 启动阶段先完成合规初始化；本包默认不持久化 appkey/secret，也不在回调路径自动初始化 SDK。

为使“授权前零 vendor SDK 调用”可验证，Android 和 iOS 都引入窄的内部 SDK adapter/protocol。生产实现转发到友盟/微信/钉钉，测试替身记录调用；测试必须证明模块构造、`preInit`、init 前 Analytics、init 前 Share 与 init 前回调均没有 vendor 调用。

## 4. JS 公共层与错误契约

### 4.1 Metro 兼容入口

`src/index.ts` 不再使用：

```ts
export * as Common from './common';
```

改为 React Native 默认 Babel/Metro 可稳定处理的普通 ESM：

```ts
import * as Common from './common';
import * as Share from './share';
import * as Analytics from './analytics';

export { Common, Share, Analytics };
```

源码入口、Bob 生成入口和 npm pack 后的消费者入口都必须通过 Metro bundle 冒烟测试，不能只依赖 TypeScript 或 Node 解析成功。

### 4.2 统一错误归一化

新增内部 `normalizeError(error, fallbackCode)`，所有 Promise 型公共 API 共用：

- 已是 `UmengError` 时原样返回。
- 普通 `Error` 或对象中的 `code` 只有命中 `ErrorCode` 白名单时才保留。
- 缺少或未知 `code` 时映射为 `E_UNKNOWN`，或由调用点提供更准确的 fallback。
- message 不是非空字符串时使用调用点默认文案。
- 原始对象保存在 `nativeError`，便于日志与诊断。

React Native native rejection 到 JS 后是附带 `code` 等字段的普通 `Error`，不能假定 bridge 会创建本包的 `UmengError`。

调用点 fallback 固定如下：

| 调用点 | 未带有效 code 的 fallback |
| --- | --- |
| `Common.init` 内部 native initialize / `isInited` | `E_UNKNOWN` |
| `shareText` / `shareImage` / `shareLink` | `E_SHARE_FAILED` |
| `isInstalled` / `listPlatforms` | `E_UNKNOWN` |
| ShareSheet Host 缺失、busy、owner 卸载 | `E_UNKNOWN`，各自使用固定 message |

Native 明确返回的 `E_NOT_INITIALIZED`、`E_PLATFORM_NOT_INSTALLED` 等白名单 code 优先于 fallback。

### 4.3 Native 结果校验

分享 API 收到 native resolve 值后必须运行时校验：

- 结果必须是对象。
- `code` 只能是 `success`、`cancel` 或 `failed`。
- `platform` 必须是受支持平台，并与本次请求的平台一致。
- 只有 `success` resolve。
- `cancel` 转换为 `E_USER_CANCEL`。
- `failed` 转换为 `E_SHARE_FAILED`。
- 未知 code、缺字段或平台不匹配转换为 `E_UNKNOWN`，不能用 TypeScript 断言把异常值当成功。

`shareText`、`shareImage`、`shareLink`、`isInstalled`、`openSheet` 与 Analytics 的参数入口补齐对象、字符串、枚举和有限数值校验，避免读取 `undefined` 时先抛出无 code 的 `TypeError`。

Analytics 保持同步 `void` API；参数非法时同步抛出 `E_INVALID_OPTIONS` 的 `UmengError`，而不是返回 rejected Promise。

`shareLink.url`、`shareImage.image` 及可选 `thumb` 只接受带 host 的绝对 `http`/`https` URL；其他 scheme、相对路径、空 host 或 URL 解析失败均 reject `E_INVALID_OPTIONS`。本轮继续执行现有“只支持网络图片”契约，不把任意字符串延迟交给 AAR 解析。

公共 `ShareCode` 和 `ShareResult.code` 都收窄为字面量 `'success'`；native 内部结果另用包含 `success | cancel | failed` 的 private `NativeShareCode`。这样公共类型与“只有成功 resolve”一致，消费者不会再对不可达的 resolved cancel/failed 分支编程。

### 4.4 测试辅助与 mock

- `__resetForTests` 不再从 `Common` 公共 namespace 暴露。
- 测试通过内部模块隔离、`jest.resetModules()` 或仅测试环境 helper 重置状态。
- `src/mock.ts` 的函数签名、返回值、错误行为和公共类型与真实 API 一致。
- mock 的取消和失败通过 `mockRejectedValue(new UmengError(...))` 表达；成功 helper 才 resolve `{ code: 'success', platform }`。
- 公共类型 JSDoc 删除过时的 `Common.init(config)`、授权前 native pre-init 等描述。

## 5. ShareSheet 会话模型

### 5.1 Controller 状态机

每次 `show()` 生成单调递增的 `sessionId`。Controller 与 Host 的事件、异步闭包和 settle 操作都携带该 ID：

```text
idle
  -> loadingPlatforms(sessionId)
  -> ready(sessionId)
  -> sharing(sessionId)
  -> settled(sessionId)
  -> idle

loadingPlatforms(sessionId)
  -> settledError(sessionId)
  -> idle
```

规则如下：

- 没有 Host 时 `openSheet` 立即 reject。
- 已有 active session 时再次 `openSheet` 立即 reject，不覆盖旧 Promise。
- Host 缺失、Host 卸载和 active session 冲突沿用现有 `E_UNKNOWN`，并分别提供稳定、可测试的 message；本轮不扩充公共 `ErrorCode` union。
- `listPlatforms` 的迟到结果只有在 ID 仍为当前 session 时才能更新 UI。
- `listPlatforms` 自身失败时用归一化错误结束当前 session，不能把所有平台静默伪装成“未安装”。
- 点击平台时先同步把 session 标记为 `sharing`，再启动异步分享，防止双击发起两次 native 调用。
- 进入 `sharing` 后立即关闭 Modal，并禁用 sheet 的 backdrop、取消按钮和 Android back 取消路径；此后的用户取消只来自 native 分享回调。迟到的 sheet 交互不得改变 Promise。
- `resolve`、`reject`、`dismiss` 都必须携带 session ID；ID 不匹配的迟到回调直接忽略。
- settle 幂等；同一 session 最多结束一次。
- session A 结束后打开 B，A 的 native 回调不能结束 B。

### 5.2 Host 生命周期

Controller 保存 `hostId -> listener` registry。Host 注册时获得单调递增 `hostId`；`show()` 从当前 registry 中选择最早注册的 Host 作为唯一 owner，并只向该 listener 定向发送事件，不再广播给全部订阅者。后注册 Host 作为 standby，只在更早 Host 卸载后的下一次 `show()` 才可能成为 owner。

Host 卸载 cleanup 除了 unsubscribe，还要通知 Controller：

- 如果 active session 正由该 Host 承载，立即 reject，避免 Promise 永久 pending。
- 已启动的 native 回调在返回时因 session 已失效而被忽略。
- 卸载非 owner Host 不得误伤 active session；多挂 Host 时也只能显示一个 Modal。

### 5.3 Modal 与未安装平台

Android 的 RN `Modal` 创建独立 native root。Modal 内容必须包在：

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  {/* backdrop 与 sheet */}
</GestureHandlerRootView>
```

外层 App 已经存在 `GestureHandlerRootView` 不能替代 Modal 内这一层。

`hideUninstalled=false` 时，未安装平台仍显示并可点击；点击后以 `E_PLATFORM_NOT_INSTALLED` 结束当前 Promise。它可以使用弱化视觉和“未安装”的 accessibility label/hint，但不能设置会吞掉 `onPress` 的 `disabled` 或 `accessibilityState.disabled`。`hideUninstalled=true` 时不渲染对应平台。

### 5.4 Native 分享请求生命周期

每个 native 分享请求持有独立的原子 settle guard，并登记到模块的 active request registry：

- 同步异常、SDK callback、Activity/bridge 销毁只能由第一个到达者 settle Promise。
- `invalidate`/React host destroy 会以 `E_SHARE_FAILED` reject 所有未完成请求并清空 registry。
- 清理后的迟到 callback 只记录并忽略。
- 没有 Promise 的生命周期入口不声称“reject”；它们只执行初始化门禁、异常捕获和安全 release。

这层 native guard 与 JS `sessionId` 各自负责不同边界：native 防一个请求多次回调，JS 防旧请求结果串到新 ShareSheet session。

## 6. Android 设计

### 6.1 授权后初始化

`NativeUmengCommon.initialize(config)` 触发的 Android 顺序为：

1. 校验完整配置。
2. `UMConfigure.preInit(applicationContext, appkey, channel)`。
3. 按配置调用 `PlatformConfig.setWeixin`、`PlatformConfig.setDing`。
4. 设置 `${applicationId}.fileprovider`。
5. `UMConfigure.init(...)`。
6. 上述 `void` 调用同步返回且未抛异常后提交 `inited=true`。

每一步按第 3.3 节记录 native 阶段；异常后状态不确定时进入 `indeterminateFailure`，不能重新从第一步盲目执行。

模块构造、Package 注册、Activity 生命周期回调和所有 Share 方法不得实例化或调用 `UMShareAPI`，除非 bootstrap 已完成初始化。Analytics 同样执行初始化门禁。

### 6.2 FileProvider

Library Manifest 内置合并项：

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
  <meta-data
      android:name="android.support.FILE_PROVIDER_PATHS"
      android:resource="@xml/react_native_umeng_file_paths" />
</provider>
```

资源文件只开放 SDK 实际缓存目录：

```xml
<paths>
  <external-files-path
      name="umeng_cache"
      path="umeng_cache/" />
</paths>
```

不采用友盟示例中的广泛 `root-path`。Android Gradle 显式声明提供 `FileProvider` 的 AndroidX Core 依赖，不依赖偶然的传递 classpath。

### 6.3 AndroidX 与 Jetifier

锁定的友盟分享 AAR `7.3.7` 仍引用 `android.support.v4.content.FileProvider`，而 Android 官方已默认关闭并计划移除 Jetifier。因此：

- example 暂时设置 `android.enableJetifier=true`。
- 安装文档明确消费者当前必须开启 Jetifier。
- 文档注明这是上游 SDK 约束，不把 Jetifier 描述为通用最佳实践。
- 增加 AGP 10 前移除该约束的兼容性说明；本轮不虚构不存在的新版友盟 AAR。

### 6.4 宿主回调 Activity

example 和文档提供可编译模板：

```kotlin
package <hostPackage>.wxapi

import com.umeng.socialize.weixin.view.WXCallbackActivity

class WXEntryActivity : WXCallbackActivity()
```

```kotlin
package <hostPackage>.ddshare

import com.umeng.socialize.media.DingCallBack

class DDShareActivity : DingCallBack()
```

Activity 必须位于最终宿主包名的 `.wxapi` 与 `.ddshare` 下。example 对宿主直接引用的友盟回调类声明对应 Android 编译依赖，不能依赖 library 的 `implementation` 泄漏到宿主 compile classpath。

友盟 AAR 会把这两个回调 Activity 合并成 exported 组件。为保证首次授权前外部 Intent 不能绕过 Common 门禁：

- Library Manifest 以同名节点覆盖为 `android:enabled="false"`。
- `initialize` 全部成功后，使用 `PackageManager.setComponentEnabledSetting` 只启用已配置平台的回调 Activity。
- 初始化失败时不启用；merged Manifest 与运行时 enabled 切换都纳入测试。
- enabled 状态可跨进程保存，表示该安装实例曾成功完成用户授权后的初始化。进程被系统杀死后返回的平台回调不再对应任何 JS Promise，只做 best-effort 处理；本包不持久化凭据、不自动重建 ShareSheet session。
- 如果宿主支持撤回同意，必须在撤回流程中禁用两个组件并重启进程，因为 vendor SDK 没有可靠的反初始化 API；文档提供对应 PackageManager 模板。

### 6.5 主线程、Promise 与 R8

所有需要 UI 线程的分享调用使用统一 helper：

- 在真正执行的 Runnable 内 `try/catch`。
- catch 后使用稳定错误码 reject。
- `Handler.post` 返回失败时 reject。
- 使用第 5.4 节的原子 settle guard，确保每个 Promise 最多 resolve/reject 一次。
- `isInstalled` 先执行初始化门禁；生命周期入口没有 Promise，只捕获并记录异常。

`consumer-rules.pro` 增加实际使用的钉钉包：

```proguard
-keep class com.android.dingtalk.share.ddsharemodule.** { *; }
-keepattributes Signature
```

保留仍有实际用途的友盟、微信规则，删除或解释无证据的宽泛规则，避免用错误的 `com.alibaba.android.**` 代替正确包名。

Android SDK adapter 提供可注入 call recorder，在有 Android SDK 的环境运行 JVM/Robolectric 或 instrumented tests，验证调用顺序、init 前零调用、异常阶段、Promise settle guard、callback component enablement 和 host destroy 清理。微信/钉钉真实 App 回跳仍标记为带凭据真机延期验收，不能用“模板编译通过”代替闭环结果。

## 7. iOS 设计

### 7.1 初始化顺序与线程

iOS 没有友盟公开 `preInit` API。用户授权后的初始化顺序为：

1. 在调用任何第三方 API 前校验完整配置。
2. 在主线程通过 `[UMSocialGlobal shareInstance].universalLinkDic` 设置 Universal Link。
3. 调用微信与钉钉 `setPlaform`，逐个检查 `BOOL` 返回值。
4. 调用 `UMConfigure initWithAppkey:channel:`。
5. `void` init 同步返回且未抛异常后提交 `_inited=YES`。

Universal Link 必须早于微信平台初始化。微信 `WXApi.registerApp` 与钉钉 `DTOpenAPI.registerApp` 的 SDK 头文件都要求主线程调用。

`UmengCommon` 使用 main method queue 或等价的显式主线程调度。不能在持有 `NSLock` 时 `dispatch_sync` 到主线程；状态检查、第三方调用和最终提交应采用不会形成跨队列死锁的结构。

上述顺序是本包选定的确定性初始化顺序；厂商头文件明确要求 Universal Link 早于平台初始化，但没有一手证据表明 `setPlaform` 必须早于 `UMConfigure init`。阶段记录、相同配置重试和 `indeterminateFailure` 遵循第 3.3 节。

### 7.2 CocoaPods 与 Codegen

Podspec 增加：

```ruby
s.module_name = "ReactNativeUmeng"
s.pod_target_xcconfig = {
  "DEFINES_MODULE" => "YES"
}
```

保留 `UmengBootstrap.h` 为 public header，使 Swift 的 `import ReactNativeUmeng` 有稳定 module map。

`package.json#codegenConfig` 增加：

```json
"ios": {
  "modulesProvider": {
    "UmengCommon": "UmengCommon",
    "UmengAnalytics": "UmengAnalytics",
    "UmengShare": "UmengShare"
  }
}
```

`RCT_EXPORT_MODULE` 可以继续兼容 legacy interop，但不能代替 New Architecture 的 modules provider。

iOS 编译验收不只检查 `import`：Swift fixture 必须实际调用 `UmengBootstrap.shared()`、URL handler 与 Universal Link handler；生成的 `RCTModuleProviders.mm` 必须包含 `UmengCommon`、`UmengAnalytics`、`UmengShare` 三个精确映射。example 启动 smoke 还要在 New Architecture 运行时取得三个 TurboModule，覆盖静态链接裁剪或 `NSClassFromString` 失败。

### 7.3 AppDelegate 与原生配置

URL Scheme 和 Universal Link 回调必须分别通知友盟与 `RCTLinkingManager`，再用两个结果的逻辑 OR 作为返回值，不能使用会短路第二个 handler 的表达式。`UmengBootstrap` 的两个 handler 先检查 `isInited`；未初始化时返回 `NO`，且不得取得 `UMSocialManager`。`RCTLinkingManager` 无论友盟状态如何都必须执行。

example 与文档补齐：

- `LSApplicationQueriesSchemes` 至少包含 `weixin`、`dingtalk`，并按锁定钉钉 SDK 实际查询加入 `dingtalk-open`；它只控制出站 `canOpenURL`，不能代替入站 URL Types。
- `CFBundleURLTypes` 使用微信 App ID 与钉钉 AppKey/Client ID 原值，不额外拼接 `wx` 或 `dingoa`。
- Associated Domains 使用 `applinks:<domain>`，不包含 URL 路径。
- Universal Link 站点同时提供 `/.well-known/apple-app-site-association`：HTTPS、有效证书、无重定向，`appID` 为正确的 Team ID + Bundle ID，并配置允许路径。
- `wechatUniversalLink` 的域名必须与 entitlement 和 AASA 匹配。
- `openURL` 与 `continueUserActivity` 的 AppDelegate 转发。
- 使用 SceneDelegate 的消费者需要同时转发 `scene:openURLContexts:`、`scene:continueUserActivity:` 与 `willConnectTo` 冷启动 connection options；example 增加不注册到运行时的 compile-only SceneDelegate fixture，确保转换和转发代码可编译。

删除 example 中与本库无关且为空的定位权限说明，避免生成没有业务依据的隐私声明。

example 只提交可辨识的占位值或由本地构建配置注入的值，不提交真实 appkey、secret 或 Universal Link 凭据；占位工程必须可以编译，真实回调由后续带凭据的真机环境验证。

## 8. 依赖策略

### 8.1 Design 与运行时 peers

全仓统一：

```json
"@unif/react-native-design": "^0.20.0",
"react-native-reanimated": "^4.5.3",
"react-native-worklets": "^0.11.3"
```

`design@0.20.x` 的发布包仍只有根入口，根入口静态导出完整 UI 组件树。Umeng 从根入口导入 `Cell`、`Button`、`useTheme` 与 `useThemedStyles` 时，Metro 仍需解析其他静态导出使用的 native/singleton peers。因此 Umeng 的 `peerDependencies` 明确声明以下范围，根 `devDependencies`、example 和 website 也显式安装兼容版本：

| 依赖 | Umeng peer 范围/测试范围 |
| --- | --- |
| `@unif/react-native-design` | `^0.20.0` |
| `@sbaiahmed1/react-native-blur` | `>=4` |
| `react` | `*`；fixture 继续使用 React 19 |
| `react-native` | `*`；fixture 继续使用 RN 0.85 |
| `react-native-gesture-handler` | `>=3.0.0 <4.0.0` |
| `react-native-reanimated` | `^4.5.3` |
| `react-native-reanimated-carousel` | `>=5.0.0 <6.0.0` |
| `react-native-safe-area-context` | `>=5` |
| `react-native-svg` | `>=15` |
| `react-native-worklets` | `^0.11.3` |

不把真实静态依赖标成 optional，也不依赖 workspace hoist 掩盖缺失声明。

截至 2026-07-30，npm 官方元数据显示 Reanimated 4.5.3 接受 RN 0.83–0.86 与 Worklets 0.10.x–0.11.x，Worklets 0.11.3 接受 RN 0.83–0.86，因此这组范围覆盖当前 RN 0.85 fixture。两者按用户要求保留 `^`；锁文件记录实际解析版本，隔离 consumer CI 必须验证 Reanimated 自身 peer 仍接受解析到的 Worklets。未来 caret 漂移到不兼容组合时直接失败，不能静默发布。

`@gorhom/bottom-sheet` 不再属于 `design@0.20.x` peers，且 Umeng 当前 ShareSheet 使用 RN `Modal`，所以从 Umeng、example、website 与安装文档中删除。

### 8.2 Babel 配置

使用 Metro 的 example 在 Babel 配置末尾加入：

```js
plugins: ['react-native-worklets/plugin']
```

插件必须放在 plugins 最后。本轮明确只在 React Native example 的 Babel 配置加入该插件；website 不新增独立 Babel 配置，而以 Docusaurus production build 作为其转换链验收。

### 8.3 Workspace 消费

example 显式依赖 `@unif/react-native-umeng: "workspace:*"`，而不是靠根 workspace 的隐式可见性。这样 example 的依赖图更接近真实消费者，也能由 Yarn 的 ghost dependency 检查发现缺失声明。

## 9. 文档、网站与 llms

所有公共行为变化同步到 README、CLAUDE.md、website docs 与生成的 llms 文件：

- 隐私指南改成授权前只调用 JS `preInit`，授权后 `init` 才进入全部 native SDK。
- 删除“友盟 Android preInit 可在授权前调用且无副作用”的过时描述。
- 安装页列出完整 peers、`design@^0.20.0`、`reanimated@^4.5.3`、`worklets@^0.11.3` 和 Worklets Babel plugin。
- 删除 Bottom Sheet 依赖和旧集成方式。
- Android 页补 FileProvider 自动合并、Jetifier、正确微信/钉钉 Activity 与编译依赖。
- iOS 页补 URL Types、Associated Domains、AppDelegate/SceneDelegate 双路转发。
- README 的初始化示例提供完整微信字段组合；iOS 示例同时包含 Universal Link，不能只传 `wechatAppId`。
- website 首页删除不存在的 `{ share }` API，改用真实 `Share.share*`/`Share.openSheet`。
- sharing guide 判定操作系统时从 `react-native` 导入并别名化 `Platform`，不能对 Umeng 分享枚举读取 `.OS`。
- ShareSheet 文档说明未安装平台点击会 reject，以及 Host unmount/单会话约束。
- API 文档、类型 JSDoc、mock 示例和测试指南保持一致。

Docusaurus 内部静态资源和链接通过 `baseUrl` helper 生成，不能硬编码根路径。`build-llms`：

- 生成正确的站点 base URL。
- 正确处理多行 `<LiveDemo>...</LiveDemo>`、单行成对标签与 `<LiveDemo />` 自闭合形式，既不泄漏演示标记，也不能误吞后续全文。
- 测试 `llms.txt` 与 `llms-full.txt` 中的链接、标题和关键 API 片段。
- llms 产物继续作为 build 时生成且被 gitignore 的文件；CI 在生成后直接校验产物内容和链接，不做没有意义的 tracked-file dirty check。

## 10. CI、构建与发布

### 10.1 Turborepo 输入

example workspace 的 native build task 使用 `$TURBO_ROOT$` 引用仓库根输入，包括：

- 根 `package.json`、`yarn.lock`、Babel/TypeScript/Codegen 配置。
- `src/**`，包括 `ShareSheet/**`。
- `android/**`、`ios/**`、Podspec。
- `example/package.json` 与对应原生工程。

不能使用从 example workspace 解析后指向错误位置的裸 `src/*.ts`、`android` 或 `ios`。

### 10.2 PR 验证

仓库新增专用验证 workflow，避免直接修改会被 org 模板同步覆盖的通用 `ci.yml`。只有另获共享模板仓库写权限时，才把可复用修复上移后重新同步。

专用 workflow 的路由固定为：

| 变更路径 | 必须运行 |
| --- | --- |
| `src/**`、根 package/TS/Babel/Bob 配置、`yarn.lock` | lint、typecheck、Jest、prepare、peer 校验、source/lib/tarball consumer smoke、website 全套、Android+iOS build |
| `example/package.json`、`example/babel.config.js`、`example/metro.config.js`、`example/index.js`、`example/src/**` | consumer bundle、Android+iOS build |
| `example/android/**`、`android/**` | Android build/manifest/minify 验证 |
| `example/ios/**`、`ios/**`、Podspec、Codegen 配置 | iOS Pod/Codegen/build 验证 |
| `website/**` | llms script tests、生成产物断言、website typecheck、production build |
| repo 专用 workflow 自身、`turbo.json` | 对应全部受影响 job |

纯 Markdown 且不进入 website/llms 的历史设计文档可以跳过 native build；任何消费者文档变更仍运行链接与 llms 验证。

### 10.3 消费者与发布产物冒烟

CI 增加三层 Metro 冒烟：

1. workspace `source` 入口。
2. `yarn prepare` 后的 `lib/module` 入口。
3. `npm pack` 生成 tarball 后，在隔离消费者 fixture 中安装并 bundle 公共入口。

Android Debug 构建默认不生成 JS bundle，不能再把 Debug assemble 当成 Metro 语法验证。Release 构建或显式 `react-native bundle` 才能覆盖该风险。

隔离消费者必须由 `mktemp` 创建在仓库 workspace 外：

- 使用自己的 manifest、lockfile 和 `node_modules`，显式安装 tarball 与全部 peers。
- 不设置回退到本仓源码的 Metro alias、resolver 或 `watchFolders`。
- 断言 `@unif/react-native-umeng` 的解析路径位于临时 fixture 的 `node_modules`。
- 分别显式 bundle tarball 中的 package root/source 条件与 `lib/module` 文件。
- 用脚本解析包的 `peerDependencies`，逐项断言 fixture 已安装且版本满足范围；不能把 Yarn warning 当成功。
- `./mock` 在隔离 Jest consumer 中执行导入、成功 resolve、取消 reject 和失败 reject 测试，不把依赖 Jest runtime 的 mock 当生产 Metro bundle 入口。

### 10.4 Native 验证

iOS CI：

- 重新运行 Pod install/Codegen。
- 编译 example。
- 通过 Swift `import ReactNativeUmeng` 并实际调用 bootstrap/两个回调方法。
- 检查生成的 modules provider 含三个精确映射，并在 New Architecture runtime 取得三个模块。
- 覆盖 AppDelegate 与 compile-only SceneDelegate fixture。
- 用 vendor adapter spy 验证 init 前构造、Analytics、Share、URL/Universal Link 回调零 vendor 调用。

Android CI/有 SDK 环境：

- 编译 example release。
- 检查 merged Manifest 中 FileProvider authority 与 path resource。
- 验证 Jetifier 后旧 Support Library 引用可用。
- 开启 minify 的 release 构建验证 consumer rules。
- 编译宿主包下的微信和钉钉回调 Activity。
- 用 SDK adapter/call recorder 验证初始化顺序、门禁、异常阶段、原子 settle 与 callback component enablement。

本地没有 Android SDK 时记录为“待外部验证”，不能声称 Android assemble 已通过。微信/钉钉真实 App 的拉起与回跳另列为带凭据真机验收，编译通过不等于回调闭环通过。

### 10.5 发布安全

- Podspec source tag 改为 `"v#{s.version}"`，与 release-it 的 `v${version}` tag 一致。
- release 触发条件包含会改变发布契约的 `package.json`、Podspec、JS/native 源码和必要构建元数据。
- release 的 Verify 阶段执行 lint、typecheck、unit tests、prepare、pack 和隔离消费者 bundle。
- 发布前断言 tarball 含声明的源码、lib、native、Podspec 与必要配置，且不包含测试和构建缓存。
- 发布前比较最新 tag 与 HEAD 的 publish contract（dependencies/peers/exports/codegen/files/构建配置）。契约变化至少强制 patch；conventional commits 推导出的 minor/major 优先。不能只“触发 workflow”后让 `chore` 类型导致无版本发布。
- 公共依赖变化必须触发并产生版本发布，不能因为只改 `package.json` 而漏发。

## 11. 兼容性与迁移

公共 namespace 和方法名保持不变，但以下行为是有意收紧：

- `Common.preInit` 不再调用 native；依赖“授权前已注册分享平台”的代码必须改为授权后等待 `Common.init()`。
- `share*`、`isInstalled`、`listPlatforms` 和 `openSheet` 在 `Common.init()` 前会 reject `E_NOT_INITIALIZED`。
- 公共 `ShareCode`/`ShareResult.code` 收窄为 `'success'`；曾处理 resolved cancel/failed 的 TypeScript 分支需要删除并改为 catch。
- Design floor 升到 `^0.20.0`，Gesture Handler 升到 3.x，Reanimated 使用 `^4.5.3`，Worklets 使用 `^0.11.3`；消费者必须同步安装 peers 和 Babel plugin。
- Android 首次初始化会启用已配置平台的回调组件；支持撤回同意的宿主需要接入文档中的禁用与进程重启步骤。

当前包仍处于 `0.x`，本轮包含公共类型收窄、peer floor 与初始化行为变化，因此发布级别至少为 minor，而不是 patch。CHANGELOG 和迁移文档必须逐项列出以上变化。

## 12. 测试矩阵与验收标准

### 12.1 JS 与 ShareSheet

- 普通 ESM 根入口可被 RN Metro 解析。
- 参数缺失、错误类型、未知平台和 malformed native result 都返回稳定 `UmengError`。
- native 普通 Error 的 code 被正确归一化，未知 code 不穿透。
- 只有 success resolve；cancel/failure/未知结果 reject。
- 公共 `ShareResult.code` 只有 `'success'`，mock 的 cancel/failure 也只能 reject。
- `preInit` 授权前不调用 vendor SDK，native module 构造无 vendor 副作用。
- 配置 trim、缺失字段和平台矩阵规范化结果可重复比较。
- init 前 Analytics native 方法 no-op。
- init 前全部 Share 方法 reject `E_NOT_INITIALIZED`，回调入口跳过 Umeng handler。
- A session 迟到回调不能 settle B。
- 双击只发起一次 native 分享。
- 多 Host 只选择一个确定性 owner；非 owner 卸载不影响 session。
- 平台查询失败从 loading 转为 reject，不伪装成未安装。
- 进入 native sharing 后 sheet 交互不能再取消当前 session。
- Host unmount 会结束 pending Promise。
- 未安装平台在显示模式下点击后 reject，不会永久 pending。
- Jest 没有未处理 rejection、`act()` 或 `console.error` 警告。

### 12.2 Android

- 授权前没有友盟、微信、钉钉 native API 调用。
- 授权后顺序为 preInit、平台配置、正式 init。
- 首次授权前两个 exported 回调 Activity 默认 disabled，成功 init 后只启用已配置平台。
- 不确定的 vendor 异常进入 terminal 状态，不承诺回滚或盲目重试。
- FileProvider 合并正确且只开放 `umeng_cache/`。
- 微信/钉钉回调 Activity 能编译并把回调交回友盟。
- 主线程异常会 reject，不会崩溃或悬空。
- React host destroy 会 settle active native requests，迟到 callback 被忽略。
- minified release 保留正确钉钉类与 Signature。

### 12.3 iOS

- Universal Link 在平台注册前设置。
- 平台注册在主线程执行并检查返回值。
- init 前 Share 与 Umeng URL handlers 均不取得 vendor manager，RCT Linking 仍收到回调。
- 已知完成阶段不重复；状态不确定的 vendor 异常要求重启进程。
- Swift 能 import Pod module。
- Codegen modules provider 包含三个精确 TurboModule 映射，运行时可取得模块。
- URL 和 Universal Link 同时通知友盟与 React Native Linking。
- Associated Domains、AASA 与 `wechatUniversalLink` 域名相互匹配，Scene warm/cold fixture 可编译。

### 12.4 工具链与文档

- 根、example、website 都声明 `design@^0.20.0`、`reanimated@^4.5.3` 与 `worklets@^0.11.3`，更新后的锁文件实际解析组合通过 peer 校验。
- Yarn 安装不再依靠 website hoist 补齐 example 缺失依赖。
- workspace 外 fixture 断言全部 peers 满足，source、lib、tarball 三种入口均能 bundle。
- website llms tests、生成产物断言、typecheck 与 production build 通过。
- 文档中不存在授权前调用 native preInit、旧 Bottom Sheet 接入或错误回调 Activity。
- 文档中不存在 `{ share }`、Umeng `Platform.OS`、不完整微信配置或未处理的 LiveDemo 形式。
- 发布路径和 Pod tag 与实际产物一致，publish contract 变化至少产生 patch。

## 13. 官方依据

- 友盟 Android PIPL 合规指引：<https://developer.umeng.com/docs/147377/detail/210108>
- 友盟 Android 分享接入与 FileProvider：<https://developer.umeng.com/docs/128606/detail/193879>
- Android 安全共享文件：<https://developer.android.com/training/secure-file-sharing/setup-sharing>
- AndroidX/Jetifier 迁移：<https://developer.android.com/jetpack/androidx/migrate?hl=zh-cn>
- React Native Android Promise：<https://reactnative.dev/docs/0.85/legacy/native-modules-android#promises>
- React Native iOS Native Module 线程：<https://reactnative.dev/docs/0.85/legacy/native-modules-ios>
- React Native TurboModule 注册：<https://reactnative.dev/docs/0.85/turbo-native-modules-introduction#register-the-native-module-in-your-app>
- React Native Linking：<https://reactnative.dev/docs/0.85/linking>
- Babel Export Namespace transform：<https://babeljs.io/docs/babel-plugin-transform-export-namespace-from/>
- Gesture Handler Modal 安装要求：<https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/>
- Reanimated 兼容矩阵：<https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/>
- Worklets Community CLI 配置：<https://docs.swmansion.com/react-native-worklets/docs/fundamentals/getting-started/>
- Yarn peerDependencies：<https://yarnpkg.com/configuration/manifest#peerDependencies>
- Yarn ghost dependency 防护：<https://yarnpkg.com/features/pnp#ghost-dependencies-protection>
- CocoaPods module 配置：<https://guides.cocoapods.org/syntax/podspec.html>
- CocoaPods Modular Headers：<https://blog.cocoapods.org/CocoaPods-1.5.0/>
- Apple `canOpenURL`：<https://developer.apple.com/documentation/uikit/uiapplication/canopenurl%28_%3A%29>
- Apple URL Types：<https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleurltypes>
- Apple Associated Domains：<https://developer.apple.com/documentation/xcode/supporting-associated-domains>
- Apple Universal Links：<https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app>
- Apple Scene URL 回调：<https://developer.apple.com/documentation/uikit/uiscenedelegate/scene%28_%3Aopenurlcontexts%3A%29>
- Apple Scene Universal Link 回调：<https://developer.apple.com/documentation/uikit/uiscenedelegate/scene%28_%3Acontinue%3A%29>
- React 异步 Effect 清理原则：<https://react.dev/learn/synchronizing-with-effects#fetching-data>
- Turborepo task inputs：<https://turborepo.dev/docs/crafting-your-repository/configuring-tasks>
- Docusaurus static assets/baseUrl：<https://docusaurus.io/docs/static-assets>
- GitHub Actions path filters：<https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>

锁定版本行为同时以 Pods 随包头文件为一手依据：UMShare 6.11.1 的 `UMSocialGlobal.h`、`UMSocialManager.h`、`WXApi.h`、`DTOpenAPI.h`，以及 UMCommon 7.5.10 的 `UMConfigure.h`。
