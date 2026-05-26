# @unif/react-native-umeng 设计文档

> 集成友盟 U-Share（微信会话/朋友圈、钉钉）与 U-App 移动统计的 React Native 桥（turbo-module）。  
> 当前 `react-native-umshare` 项目重命名为 `react-native-umeng`，承载分享 + 统计两类能力。

## 1. 目标与范围

### 1.1 包含
- **Common（基础组件）**：`UMConfigure.preInit` + `UMConfigure.init` 两阶段、初始化状态查询。preInit/init 是 UMCommon 提供的基础能力，被分享回流统计、自动数据采集共用
- **Share（社会化分享）**：
  - 平台：微信会话、钉钉
  - 内容类型：文本 / 图片 / 链接卡片
  - **内置 ShareSheet 面板**：命令式 API `Share.openSheet(payload)`，弹出 RN 实现的半屏 ActionSheet，用户选平台后自动调用对应分享，resolve 出 `ShareResult`
  - 底层方法（`shareText` / `shareImage` / `shareLink` / `isInstalled`）仍暴露给想跳过面板的场景
- **Analytics（移动统计）**：`onEvent`、`reportError`、`onProfile signIn/signOut`
- iOS 14+、Android API 21+

### 1.2 不包含（明确排除，后续可增量）
- 微信朋友圈分享（首版不做；后续如要支持，加 `Platform.WECHAT_TIMELINE` 即可）
- 小程序分享 / 视频分享
- 平台授权登录、第三方登录
- 友盟 U-Link 深链回流
- 友盟推送（U-Push）、性能监控（U-APM）
- **友盟原生 shareboard**：不引入 `UMShare/UI`，面板由 RN 自己画

## 2. 包元信息

| 字段 | 值 |
| --- | --- |
| 包名 | `@unif/react-native-umeng` |
| 仓库目录 | `react-native-umeng/`（由 `react-native-umshare/` `git mv` 改名） |
| 私服 registry | `https://npm.unif.internal` |
| Repository | `https://github.com/unif-design/react-native-umeng.git` |
| 类型 | React Native turbo-module |
| iOS 语言 | Swift（通过 module map 调用友盟 OC SDK） |
| Android 语言 | Kotlin |
| 错误码风格 | SCREAMING_SNAKE |

## 3. 架构

采用 **拆三个独立 TurboModule**：

```
src/
├── index.ts                 ← re-export Common / Share / Analytics / 类型
├── common.ts                ← Common JS API（init / 状态）
├── share.ts                 ← Share JS API
├── analytics.ts             ← Analytics JS API
├── types.ts                 ← Platform enum、ShareResult、ErrorCode
├── NativeUmengCommon.ts     ← codegen spec (TurboModule)
├── NativeUmengShare.ts      ← codegen spec (TurboModule)
└── NativeUmengAnalytics.ts  ← codegen spec (TurboModule)

ios/
├── UmengCommon.swift        ← @objc class, 实现 UmengCommonSpec
├── UmengShare.swift         ← @objc class, 实现 UmengShareSpec
├── UmengAnalytics.swift     ← @objc class, 实现 UmengAnalyticsSpec
├── UmengBootstrap.swift     ← 内部 helper 单例（preInit + setPlatform，3 个 module 共用）
└── ReactNativeUmeng-Bridging-Header.h  ← 引入 <UMCommon/...>、<UMShare/...> 头

android/src/main/java/com/unif/reactnativeumeng/
├── UmengCommonModule.kt          ← TurboModule 1
├── UmengShareModule.kt           ← TurboModule 2
├── UmengAnalyticsModule.kt       ← TurboModule 3
├── UmengBootstrap.kt             ← 内部 helper 单例（preInit + setPlatform）
└── ReactNativeUmengPackage.kt    ← 注册三个 TurboModule

ReactNativeUmeng.podspec
```

**三个 TurboModule 通过 `UmengBootstrap` 单例共享一次性 preInit**：
- 任意 TurboModule 被构造时，其 `init()` / `initialize()` 第一步都调用 `UmengBootstrap.shared.ensurePreInit(context)`
- `UmengBootstrap` 内部加锁、记 inited 标志，保证 preInit + setPlatform 仅执行一次
- `UmengBootstrap` 不是 TurboModule，是纯 native helper；它**也持有 `init()` 的实现**，由 `UmengCommonModule.init()` 转发调用
- 设计动机：Share / Analytics 都要保证 preInit 已就绪，Common 则承载用户主动触发的 `init()`

## 4. 公共类型

```ts
// src/types.ts
export enum Platform {
  WECHAT_SESSION = 'wechat_session',
  DINGTALK = 'dingtalk',
}

/** 本桥首版支持的平台清单（顺序即 ShareSheet 默认渲染顺序） */
export const SUPPORTED_PLATFORMS: Platform[] = [
  Platform.WECHAT_SESSION,
  Platform.DINGTALK,
];

export interface PlatformInfo {
  platform: Platform;
  installed: boolean;
  displayName: string;   // '微信' / '钉钉'，本桥内置
}

/** ShareSheet 的 payload（与底层 shareXxx 的 options 对齐，无 platform 字段——由用户在面板上选） */
export type ShareSheetPayload =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; thumb?: string }
  | { type: 'link'; title: string; url: string; description?: string; thumb?: string };

export interface ShareSheetOptions {
  title?: string;          // 面板标题，默认 '分享到'
  cancelText?: string;     // 取消按钮文案，默认 '取消'
  /** 隐藏未安装的平台（默认 false，未安装时按钮置灰） */
  hideUninstalled?: boolean;
}

export type ShareCode = 'success' | 'cancel' | 'failed';

export interface ShareResult {
  code: ShareCode;
  message?: string;
  platform: Platform;
}

export type ErrorCode =
  | 'E_PLATFORM_NOT_INSTALLED'   // 微信/钉钉未安装
  | 'E_PLATFORM_NOT_SUPPORTED'   // platform 字符串错
  | 'E_INVALID_OPTIONS'          // 参数缺失/类型错
  | 'E_USER_CANCEL'              // 用户取消
  | 'E_SHARE_FAILED'             // 友盟回调失败
  | 'E_NOT_INITIALIZED'          // analytics 未 init
  | 'E_UNKNOWN';
```

Promise reject 时，错误对象 `{ code: ErrorCode, message: string, nativeError?: unknown }`。

## 5. JS API

### 5.1 Common（基础组件）

```ts
// src/common.ts
export function init(): Promise<void>;           // 启动 UMConfigure.init，开始数据采集；用户同意隐私协议后调
export function isInited(): Promise<boolean>;    // 查询是否已 init 完成（false = preInit 完成但 init 未跑）
```

调用样例：

```ts
import { Common } from '@unif/react-native-umeng';

// 用户同意《隐私协议》后
await Common.init();
console.log(await Common.isInited());  // true
```

> `preInit` **没有** JS 接口 —— 它由原生 TurboModule 构造时自动执行；JS 侧只暴露 `init()` 这个合规层 trigger。

### 5.2 Share

```ts
// src/share.ts
import type { Platform, ShareResult } from './types';

export interface ShareTextOptions {
  platform: Platform;
  text: string;
}

export interface ShareImageOptions {
  platform: Platform;
  image: string;       // http(s) URL 或本地文件路径
  thumb?: string;      // 缩略图（钉钉/微信 link 模式用）
}

export interface ShareLinkOptions {
  platform: Platform;
  title: string;
  url: string;
  description?: string;
  thumb?: string;
}

/** 命令式面板：弹出 → 选平台 → 分享 → resolve */
export function openSheet(payload: ShareSheetPayload,
                          options?: ShareSheetOptions): Promise<ShareResult>;

/** 底层 API（不弹面板，按 platform 直拉），供有自定义 UI 需求的场景 */
export function shareText(options: ShareTextOptions): Promise<ShareResult>;
export function shareImage(options: ShareImageOptions): Promise<ShareResult>;
export function shareLink(options: ShareLinkOptions): Promise<ShareResult>;
export function isInstalled(platform: Platform): Promise<boolean>;
export function listPlatforms(): Promise<PlatformInfo[]>;
```

最常见用法（命令式）：

```ts
import { Share } from '@unif/react-native-umeng';

const r = await Share.openSheet({
  type: 'link',
  title: '问问看',
  url: 'https://example.com/x',
  description: '一句话描述',
  thumb: 'https://example.com/x/thumb.png',
});
if (r.code === 'success') {
  // r.platform === 'wechat_session' 或 'dingtalk'
}
```

跳过面板直拉某平台：

```ts
import { Share, Platform } from '@unif/react-native-umeng';

await Share.shareLink({ platform: Platform.WECHAT_SESSION, title, url, description, thumb });
```

### 5.2.1 ShareSheet UI 规约

- **形态**：底部半屏 Modal（`react-native` 内置 `Modal`），透明遮罩 + 圆角 sheet
- **内容**：标题行（`options.title ?? '分享到'`）→ 平台按钮横排（图标 + 名称）→ 取消按钮
- **平台按钮**：图标 + `displayName`；未安装时若 `hideUninstalled=true` 则不渲染，否则按钮置灰且点击 reject `E_PLATFORM_NOT_INSTALLED`
- **取消**：点取消 / 点遮罩 → reject `E_USER_CANCEL`
- **关闭逻辑**：分享完成 / 用户取消 → 自动关闭
- **资源**：微信、钉钉图标内置在包 `src/assets/`（PNG @1x/@2x/@3x）
- **样式**：默认浅色主题；本版**不**做主题/暗色模式切换（后续增量）

### 5.2.2 实现说明

`openSheet` 通过模块级 `ShareSheetController` 单例管理 Modal：

```
openSheet(payload)
   │
   ├─ controller.show(payload) → 调用挂载的 ShareSheetHost 渲染 Modal
   │
   ├─ 用户点击平台按钮
   │   └─ 内部调用 shareLink/shareImage/shareText → 等回包 → resolve openSheet 的 Promise
   │
   └─ 用户点取消/遮罩 → controller.dismiss('cancel') → reject E_USER_CANCEL
```

**集成方需要**：在 App 根组件树挂一次 `<ShareSheetHost />`（无 props，自动接管 Modal 渲染）。  
README 给出代码片段。

```tsx
// App.tsx
import { ShareSheetHost } from '@unif/react-native-umeng';

export default function App() {
  return (
    <>
      <NavigationContainer>...</NavigationContainer>
      <ShareSheetHost />   {/* 一次性挂在根 */}
    </>
  );
}
```

### 5.3 Analytics

```ts
// src/analytics.ts
export function onEvent(eventId: string,
                        params?: Record<string, string>): void;
export function reportError(error: Error | string): void;
export function signIn(userId: string, provider?: string): void;
export function signOut(): void;
```

调用样例：

```ts
import { Common, Analytics } from '@unif/react-native-umeng';

await Common.init();                                  // 隐私协议同意后
Analytics.onEvent('login', { channel: 'wechat' });
Analytics.signIn('user-123', 'wechat');
Analytics.reportError(new Error('something went wrong'));
```

> `Analytics` 上所有方法在 `Common.init()` 之前调用，原生 SDK 行为是：缓存在本地或丢弃（友盟默认）。本桥不强制抛 `E_NOT_INITIALIZED`，但 README 会写明先 `Common.init()`。

### 5.4 index 出口

```ts
// src/index.ts
export * as Common from './common';
export * as Share from './share';
export * as Analytics from './analytics';
export { ShareSheetHost } from './ShareSheet/ShareSheetHost';
export { Platform, SUPPORTED_PLATFORMS } from './types';
export type { ShareCode, ShareResult, ErrorCode,
             ShareTextOptions, ShareImageOptions, ShareLinkOptions,
             ShareSheetPayload, ShareSheetOptions, PlatformInfo } from './types';
```

## 6. TurboModule Native Spec

### 6.1 NativeUmengCommon.ts

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  init(): Promise<void>;
  isInited(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengCommon');
```

### 6.2 NativeUmengShare.ts

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// 与 JS Platform enum 对应的字符串字面量
export type NativePlatform = 'wechat_session' | 'wechat_timeline' | 'dingtalk';

export interface NativeShareResult {
  code: string;       // 'success' | 'cancel' | 'failed'
  message?: string;
  platform: string;
}

export interface Spec extends TurboModule {
  shareText(platform: string, text: string): Promise<NativeShareResult>;
  shareImage(platform: string, image: string, thumb?: string): Promise<NativeShareResult>;
  shareLink(platform: string, title: string, url: string,
            description?: string, thumb?: string): Promise<NativeShareResult>;
  isInstalled(platform: string): Promise<boolean>;
  // listPlatforms / openSheet 不进 native spec —— 它们是 JS 侧组合：
  //   listPlatforms = SUPPORTED_PLATFORMS.map(p => ({ p, installed: isInstalled(p), name }))
  //   openSheet     = 内部用 RN Modal 渲染 UI，按用户选择调用 shareXxx
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengShare');
```

### 6.3 NativeUmengAnalytics.ts

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  onEvent(eventId: string, params: Object): void;
  reportError(message: string): void;
  signIn(userId: string, provider?: string): void;
  signOut(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengAnalytics');
```

JS facade（`common.ts` / `share.ts` / `analytics.ts`）负责把 Platform enum 转字符串、组织参数、把原生回包翻成 ShareResult 或抛错。

## 7. 原生 SDK 依赖与版本

### 7.1 Android（gradle）

```groovy
// android/build.gradle - dependencies
implementation 'com.umeng.umsdk:common:9.9.1'      // 基础组件
implementation 'com.umeng.umsdk:asms:1.8.7.2'      // 设备指纹基础
implementation 'com.umeng.umsdk:share-core:7.3.7'  // 分享核心
implementation 'com.umeng.umsdk:share-wx:7.3.7'    // 微信
implementation 'com.umeng.umsdk:share-dingding:7.3.7' // 钉钉

// 微信官方 SDK
implementation 'com.tencent.mm.opensdk:wechat-sdk-android:6.8.0'

// 钉钉官方 SDK（友盟 share-dingding 内部依赖；如冲突可显式声明）
```

> 版本号来源：Maven Central（`repo1.maven.org/maven2/com/umeng/umsdk/`）当前最新稳定版。  
> 钉钉 SDK 由友盟 share-dingding 传递依赖，**实现阶段** 验证传递结果；若有冲突再显式锁定 `com.alibaba.android:ddsharekit:<x.y.z>`。

### 7.2 iOS（podspec）

```ruby
# ReactNativeUmeng.podspec
s.dependency 'UMCommon'                  # 基础
s.dependency 'UMDevice'                  # 设备指纹
s.dependency 'UMAPM'                     # （可选，含错误上报）
s.dependency 'UMShare/UI'                # 分享核心（subspec UI 是必需的基础，含资源；本包不调用 shareboard 面板）
s.dependency 'UMShare/Social/WeChat'     # 微信子 spec
s.dependency 'UMShare/Social/DingDing'   # 钉钉子 spec

s.dependency 'WechatOpenSDK-XCFramework' # 微信官方 SDK（友盟壳依赖）
```

> iOS 版本号：当前 Cocoapods/Specs 主线版本 `UMCommon ~> 7.5+`、`UMShare ~> 6.10+`、`WechatOpenSDK-XCFramework ~> 2.0+`。**实现阶段** 用 `pod search` 锁定写入 podspec。

## 8. 集成方配置（README 写明）

### 8.1 iOS `Info.plist`

```xml
<!-- 友盟 appkey -->
<key>UMENG_APPKEY</key>
<string>YOUR_UMENG_APPKEY</string>
<key>UMENG_CHANNEL</key>
<string>App Store</string>

<!-- 微信 -->
<key>UMENG_WECHAT_APPID</key>
<string>wxXXXXXXXX</string>
<key>UMENG_WECHAT_APPSECRET</key>
<string>XXXXXXXX</string>

<!-- 钉钉 -->
<key>UMENG_DINGTALK_APPID</key>
<string>dingoaXXXXXXXX</string>

<!-- 跳转白名单 -->
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>weixin</string>
  <string>weixinULAPI</string>
  <string>wechat</string>
  <string>dingtalk</string>
  <string>dingtalk-open</string>
</array>

<!-- 回调 URL Scheme -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>weixin</string>
    <key>CFBundleURLSchemes</key>
    <array><string>wxXXXXXXXX</string></array>
  </dict>
  <dict>
    <key>CFBundleURLName</key>
    <string>dingtalk</string>
    <key>CFBundleURLSchemes</key>
    <array><string>dingoaXXXXXXXX</string></array>
  </dict>
</array>
```

### 8.2 iOS AppDelegate（README 给代码片段）

```swift
import UmengBootstrap  // 由本包导出，让宿主能调用 handleOpenURL

func application(_ app: UIApplication, open url: URL,
                 options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
  if UmengBootstrap.shared.handleOpenURL(url) { return true }
  return false
}
```

### 8.3 Android `AndroidManifest.xml`

```xml
<application>
  <meta-data android:name="UMENG_APPKEY" android:value="@string/umeng_appkey"/>
  <meta-data android:name="UMENG_CHANNEL" android:value="default"/>
  <meta-data android:name="UMENG_WECHAT_APPID" android:value="@string/wechat_appid"/>
  <meta-data android:name="UMENG_WECHAT_APPSECRET" android:value="@string/wechat_appsecret"/>
  <meta-data android:name="UMENG_DINGTALK_APPID" android:value="@string/dingtalk_appid"/>
</application>

<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

### 8.4 Android 回调 Activity（集成方在自己包下创建）

微信和钉钉要求回调 Activity 在 **App 自己的包名** 下。集成方需手动添加：

```kotlin
// {appPkg}/wxapi/WXEntryActivity.kt
package com.example.app.wxapi
class WXEntryActivity : com.umeng.socialize.weixin.view.WXCallbackActivity()
```

```kotlin
// {appPkg}/ddshare/DDShareActivity.kt
package com.example.app.ddshare
class DDShareActivity : com.umeng.socialize.dingding.DDShareCallbackActivity()
```

并在 `AndroidManifest.xml` 注册：

```xml
<activity android:name=".wxapi.WXEntryActivity"
          android:exported="true"
          android:taskAffinity="${applicationId}"
          android:launchMode="singleTask"/>

<activity android:name=".ddshare.DDShareActivity"
          android:exported="true"
          android:taskAffinity="${applicationId}"
          android:launchMode="singleTask">
  <intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <data android:scheme="dingoaXXXXXXXX"/>
  </intent-filter>
</activity>
```

> README 给完整模板可直接复制。

## 9. 初始化流程（PIPL 合规两阶段）

```
App 冷启动
   │
   ▼
任一 TurboModule 首次构造（Common / Share / Analytics）
   ├─ UmengBootstrap.ensurePreInit(context)   // 加锁单次
   │    ├─ 读 Info.plist / Manifest meta-data
   │    ├─ UMConfigure.preInit(appkey, channel)
   │    ├─ UMShareConfig.setPlatform(WECHAT, appId, appSecret, ...)
   │    └─ UMShareConfig.setPlatform(DINGDING, appId)
   ▼
JS 启动
   │
   ▼ 用户首次同意《隐私协议》
JS: await Common.init()
   │
   ▼ 原生 UmengCommonModule.init() → UmengBootstrap.ensureInit()
   │    └─ UMConfigure.init(appkey, channel, deviceType, secret)
开始正式数据采集 + 分享回流统计
```

要点：
- **preInit 不上报任何数据**，符合 PIPL 合规
- **init 必须在用户同意后调**；未同意前 `Analytics.onEvent` 会进入本地缓存或直接丢弃（友盟 SDK 行为）
- **分享操作（`Share.shareXxx`）** 在 preInit 后即可调用，不强制 init；只是回流统计要 init 后才开始
- **init 是 idempotent**：重复调 `Common.init()` 仅触发一次原生 `UMConfigure.init`，第二次 resolve 立即返回

## 10. 错误处理

### 10.1 Promise reject 形态
```ts
try {
  await Share.shareLink({...});
} catch (e) {
  // e.code: ErrorCode
  // e.message: 友盟原始 message 或我们的描述
  // e.nativeError: 原生抛的 NSError / Throwable（仅 debug 友好）
}
```

### 10.2 错误码与原生映射

| ErrorCode | 触发条件 | 原生侧检测点 |
| --- | --- | --- |
| `E_PLATFORM_NOT_INSTALLED` | 微信/钉钉未安装 | `UMSocialManager.isInstall(platform)` |
| `E_PLATFORM_NOT_SUPPORTED` | platform 字串不在白名单 | TS facade + 原生 enum 校验 |
| `E_INVALID_OPTIONS` | 必填字段缺失 / URL 格式错 | TS facade 优先；原生兜底 |
| `E_USER_CANCEL` | 友盟回调 `cancel` | iOS `UMSocialPlatformErrorType.cancel` / Android `onCancel` |
| `E_SHARE_FAILED` | 友盟回调 `error` | iOS `onResponse` 带 error；Android `onError` |
| `E_NOT_INITIALIZED` | （保留预案）`Common.init()` 失败或 SDK 内部状态异常 | `UmengBootstrap.isInited` 标志；当前 Analytics API 不强制抛错 |
| `E_UNKNOWN` | 其它 | catch-all |

## 11. example 验证矩阵

example 工程要覆盖：

**Common 部分（2 case）**
- 触发 `Common.init()`（隐私同意按钮）
- 显示 `Common.isInited()` 当前状态

**Share 部分（4 case）**
- `Share.openSheet({ type: 'link', ... })` —— **主验证用例**：弹面板、选平台、看 ShareResult
- `Share.openSheet({ type: 'text', text })`
- `Share.openSheet({ type: 'image', image })`
- 底层直拉：`Share.shareLink({ platform: WECHAT_SESSION, ... })`（验证跳过面板的能力）

**Analytics 部分（4 case）**
- `onEvent('demo_event', { source: 'btn' })`
- `reportError(new Error('manual report'))`
- `signIn('demo-user-123')`
- `signOut()`

**根组件挂载 `<ShareSheetHost />`** —— example App 的根 component 必须挂这个，否则 openSheet 报错

每个按钮调用后用 `Toast` / `Alert` 显示返回的 `code` 和 `message`。

## 12. 测试策略

### 12.1 单元测试（jest）
- `src/common.ts` / `src/share.ts` / `src/analytics.ts`：
  - 参数校验（缺字段抛 `E_INVALID_OPTIONS`）
  - Platform enum → 字符串映射
  - 原生回包 → ShareResult 转换
  - `Common.init` idempotent（重复调只触发一次原生）
- ShareSheet 组件（react-test-renderer 或 @testing-library/react-native）：
  - 渲染平台按钮（按 SUPPORTED_PLATFORMS 顺序）
  - 未安装时按钮置灰 / 点击取消正确 reject
  - openSheet 单例：未挂 `<ShareSheetHost />` 时 reject 友好错误
- mock `TurboModuleRegistry` 提供假桥

### 12.2 真机集成测试（手动 / 文档化清单）
- iOS 真机装微信 + 钉钉，跑 example 9 个分享 case + 5 个统计 case
- Android 真机同上
- 验证：
  - 跳转 → 三方 App
  - 三方 App 完成分享 → 回到 example → 收到 `success` callback
  - 用户在三方 App 取消 → 回到 example → 收到 `cancel` callback
  - 友盟后台数据看板有数据（init 之后）

## 13. 文件结构（最终落地）

```
react-native-umeng/
├── docs/
│   └── superpowers/specs/2026-05-26-umeng-wechat-dingtalk-design.md  ← 本文档
├── src/
│   ├── index.ts
│   ├── common.ts
│   ├── share.ts
│   ├── analytics.ts
│   ├── types.ts
│   ├── NativeUmengCommon.ts
│   ├── NativeUmengShare.ts
│   ├── NativeUmengAnalytics.ts
│   ├── ShareSheet/
│   │   ├── ShareSheetHost.tsx      ← Modal Host 组件
│   │   ├── ShareSheetController.ts ← 单例：openSheet/dismiss
│   │   └── styles.ts
│   └── assets/
│       ├── wechat@1x.png  @2x.png  @3x.png
│       └── dingtalk@1x.png  @2x.png  @3x.png
├── src/__tests__/
│   ├── common.test.ts
│   ├── share.test.ts
│   ├── share-sheet.test.tsx
│   └── analytics.test.ts
├── ios/
│   ├── UmengCommon.swift
│   ├── UmengShare.swift
│   ├── UmengAnalytics.swift
│   ├── UmengBootstrap.swift
│   └── ReactNativeUmeng-Bridging-Header.h
├── android/src/main/java/com/unif/reactnativeumeng/
│   ├── UmengCommonModule.kt
│   ├── UmengShareModule.kt
│   ├── UmengAnalyticsModule.kt
│   ├── UmengBootstrap.kt
│   └── ReactNativeUmengPackage.kt
├── android/build.gradle
├── ReactNativeUmeng.podspec
├── example/
│   └── src/App.tsx       ← 9 share + 5 analytics 按钮
├── package.json
└── README.md             ← 集成说明（plist / Manifest / Activity 模板）
```

## 14. 落地步骤总览（高阶，后续 writing-plans 细化）

1. `git mv` 目录 `react-native-umshare` → `react-native-umeng`，同步改 package.json、podspec、Java 包名、iOS 类名
2. JS 侧基础：types / NativeUmengCommon / NativeUmengShare / NativeUmengAnalytics / common / share / analytics / index + 单测
3. Android：`UmengBootstrap` + `UmengCommonModule` + `UmengShareModule` + `UmengAnalyticsModule` + `ReactNativeUmengPackage`，gradle 依赖
4. iOS：`UmengBootstrap.swift` + `UmengCommon.swift` + `UmengShare.swift` + `UmengAnalytics.swift`，bridging header，podspec 依赖
5. **ShareSheet（RN）**：`ShareSheetController` 单例 + `ShareSheetHost` 组件 + 图标资源 + 组件单测
6. example：根组件挂 `<ShareSheetHost />`；2 common + 4 分享（含 openSheet 主用例 + 1 个直拉）+ 4 统计按钮
6. README：宿主 App 集成步骤（plist、Manifest、WXEntryActivity / DDShareActivity 模板、AppDelegate handleOpenURL）
7. 真机回归

## 15. 风险与待确认

- **iOS pod 具体版本号**：当前用 `UMCommon ~> 7.5`、`UMShare ~> 6.10` 写在 podspec；实施时 `pod search` 锁版本
- **钉钉 Android SDK 传递依赖**：是否被 `share-dingding:7.3.7` 完整带入，待 gradle resolve 时验证；如缺失则显式声明
- **Swift TurboModule** 在 React Native 0.85 的稳定性：spec 协议是 OC，Swift 类需 `@objc` + 协议符合；如遇 codegen 问题则退回到 Obj-C++ shim 包一层（不影响公共 API）
- **钉钉回调 Activity 命名**：钉钉按 Activity 名查找，必须是 `{appPkg}/ddshare/DDShareActivity`；集成方按 README 添加
- **微信/钉钉回调 Activity 基类的全限定名**：示例中给的是 `com.umeng.socialize.weixin.view.WXCallbackActivity` / `com.umeng.socialize.dingding.DDShareCallbackActivity`，**实现阶段** 按 share-wx / share-dingding 7.3.7 的 sources jar 实际类名校正
- **隐私协议** 文案不在本包范围，由集成方在宿主 App 提供；本包仅控制 `Common.init()` 调用时机
- **`<ShareSheetHost />` 单例假设**：本版要求集成方在根组件挂一个 host，多次挂载行为未定义；实现时 Host 内部用 `useId` 加 controller 注册表，若注册超过 1 个则 dev mode 抛 warning
- **微信/钉钉图标**：随包内置 PNG（@1x/@2x/@3x），版权使用各平台公开 brand 资源；若不允许内嵌可改为允许集成方传 `iconResolver` 自定义

---

设计文档完，等用户审阅后转入 writing-plans。
