# @unif/react-native-umeng 设计文档

> 集成友盟 U-Share（微信会话/朋友圈、钉钉）与 U-App 移动统计的 React Native 桥（turbo-module）。  
> 当前 `react-native-umshare` 项目重命名为 `react-native-umeng`，承载分享 + 统计两类能力。

## 1. 目标与范围

### 1.1 包含
- **Common（基础组件）**：触发友盟数据采集启动（PIPL 合规层）、状态查询
  - **Android**：模块构造期自动调 `UMConfigure.preInit(ctx, appkey, channel)`（无差别、不采集）；JS `Common.init()` 触发 `UMConfigure.init(...)`（用户同意后开始采集）
  - **iOS**：友盟 iOS 公开 SDK 没有 preInit；JS `Common.init()` 触发首次 `UMConfigure.initWithAppkey:channel:`（用户同意前模块构造期完全不调任何友盟 API）
- **Share（社会化分享）**：
  - 平台：微信会话、钉钉
  - 内容类型：文本 / 图片 / 链接卡片
  - **内置 ShareSheet 面板**：命令式 API `Share.openSheet(payload)`，弹出 RN 实现的半屏 ActionSheet，用户选平台后自动调用对应分享，resolve 出 `ShareResult`
  - 底层方法（`shareText` / `shareImage` / `shareLink` / `isInstalled`）仍暴露给想跳过面板的场景
- **Analytics（移动统计）**：`onEvent`、`onProfile signIn/signOut`
- iOS 15.1+（RN 0.85 要求）、Android API 21+

### 1.2 不包含（明确排除，后续可增量）
- 微信朋友圈分享（首版不做；后续如要支持，加 `Platform.WECHAT_TIMELINE` 即可）
- 小程序分享 / 视频分享
- 平台授权登录、第三方登录
- 友盟 U-Link 深链回流
- 友盟推送（U-Push）、性能监控（U-APM）（友盟 9.3.6+ 已将崩溃捕获移出 U-App 统计 SDK，需 U-APM；本桥不暴露 `reportError`）
- **友盟原生 shareboard**：不引入 `UMShare/UI`，面板由 RN 自己画

## 2. 包元信息

| 字段 | 值 |
| --- | --- |
| 包名 | `@unif/react-native-umeng` |
| 仓库目录 | `react-native-umeng/`（由 `react-native-umshare/` `git mv` 改名） |
| 私服 registry | `https://npm.unif.internal` |
| Repository | `https://github.com/unif-design/react-native-umeng.git` |
| 类型 | React Native turbo-module |
| 公共依赖 | peerDependencies: `@unif/react-native-design >=0.1.2`、`@gorhom/bottom-sheet >=5`、`react-native-gesture-handler >=2.21.0`、`react-native-svg >=15`（ShareSheet UI 复用 design 系统的 `<BottomSheet>`、`<Cell>`、`<Button>`；品牌 glyph 用 react-native-svg 画） |
| iOS 语言 | **ObjC++ shim（`.mm`）+ Swift Adapter（`.swift`）** — RN 0.85 不支持纯 Swift TurboModule，必须用官方 Adapter Pattern：codegen 生成的 OC 协议由 `.mm` 类符合并 forward 到 `@objcMembers public class XxxImpl: NSObject` Swift 类 |
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

ios/                                 ← 三件套 × 3 module + 共享 helper
├── UmengCommon.h            ← @interface UmengCommon: NSObject <NativeUmengCommonSpec>
├── UmengCommon.mm           ← ObjC++ shim，forward 到 UmengCommonImpl
├── UmengCommonImpl.swift    ← @objcMembers public class，Swift 业务
├── UmengShare.h / .mm / UmengShareImpl.swift
├── UmengAnalytics.h / .mm / UmengAnalyticsImpl.swift
├── UmengBootstrap.swift     ← 内部 helper 单例（iOS：无 preInit；持 setPlaform 配置入口）
└── (无单独 Bridging Header — 库不需要，宿主 App Podfile 用 use_modular_headers! 让 Swift 看到友盟 OC 头)

android/src/main/java/com/unif/reactnativeumeng/
├── UmengCommonModule.kt          ← TurboModule 1
├── UmengShareModule.kt           ← TurboModule 2
├── UmengAnalyticsModule.kt       ← TurboModule 3
├── UmengBootstrap.kt             ← 内部 helper 单例（preInit + setPlatform）
└── ReactNativeUmengPackage.kt    ← 注册三个 TurboModule

ReactNativeUmeng.podspec
```

**三个 TurboModule 通过 `UmengBootstrap` 单例共享初始化状态**：

**Android**：
- 任一 TurboModule 构造时，调用 `UmengBootstrap.ensurePreInit(ctx)`（加锁单次）：
  - 读 Manifest `meta-data`
  - `UMConfigure.preInit(ctx, appkey, channel)` — 不采集、可在用户同意前调
- `Common.init()` 触发 `UmengBootstrap.ensureInit(ctx)`（加锁单次）：
  - `UMConfigure.init(ctx, appkey, channel, DEVICE_TYPE_PHONE, "")`
  - `PlatformConfig.setWeixin(...)` + `PlatformConfig.setDing(...)`（必须在 `init` 之后）

**iOS**：
- TurboModule 构造时**不调任何友盟 API**（友盟 iOS 没有 preInit；PIPL 要求未同意前不能触发 SDK）
- `Common.init()` 触发 `UmengBootstrap.ensureInit()`（加锁单次）：
  - 读 Info.plist 配置
  - `UMConfigure.initWithAppkey(_:channel:)`
  - `UMSocialManager.default()?.setPlaform(.wechatSession, appKey:appSecret:redirectURL:)`（注意 SDK 拼写错误 `setPlaform`）
  - `setPlaform(.dingDing, ...)`
  - 如有 UL，`UMSocialGlobal.shareInstance().universalLinkDic = [...]`

**`UmengBootstrap` 不是 TurboModule**，是纯 native helper，三个 module 共用。

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
  title?: string;          // 面板标题，默认 '分享至'
  cancelText?: string;     // 取消按钮文案，默认 '取消'
  /** 平台副标题覆盖；默认：微信 = '发送给好友或群'，钉钉 = '发送至工作群' */
  subtitles?: Partial<Record<Platform, string>>;
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

**UI 视觉规约来源**：Anthropic Claude Design 出的设计稿 `Share Panel`（已落盘到 `docs/superpowers/design-refs/share-panel/`，含 `share-panel.jsx`、`styles.css`、`README.md`）。设计稿提供 3 个 variant（list / tiles / grid），**v1 只实现 list**（最贴近 DS 的 `list-flush + cell + leading` 模式；其余 variant 后续增量）。

**实现完全基于 `@unif/react-native-design`** —— 不再裸用 RN `Modal`：

- **容器**：`<BottomSheet snapPoints={['30%']} grabber backdrop='scrim' onClose={...}>`（来自 design 系统）
  - 内部基于 `@gorhom/bottom-sheet` + `react-native-gesture-handler`，宿主 App 须挂 `GestureHandlerRootView`
  - 主题色 / scrim / 圆角 / 阴影由 design 的 `ThemeProvider` 提供
  - sheet 顶部圆角 18px，padding `6px 14px 18px`（设计稿 `styles.css` 规约）

- **内容布局**（自上而下）：
  1. **grabber**：design 的 `<BottomSheet grabber>` 已自带（36×4px 圆角胶囊）
  2. **sheet 头部**：左侧标题 `options.title ?? '分享至'`（15px / `fw-semi` / letter-spacing -0.1px），右侧 26×26 圆形关闭按钮（`surface-container` 背景 + close icon）
  3. **平台行（list variant）**：每个平台一个 `<Cell>`
     - `leading`: 32×32 圆角 8、品牌色背景的方块（微信 `#07C160`、钉钉 `#1677FF`），内含 18px 白色 SVG glyph（用 `react-native-svg`，glyph path 直接搬设计稿 `share-panel.jsx` 的 `WeChatGlyph` / `DingTalkGlyph`）
     - `title`: 平台名（"微信" / "钉钉"）
     - `desc`: 副标题（默认"发送给好友或群" / "发送至工作群"，可通过 `options.subtitles[platform]` 覆盖）
     - 右箭头：design 的 `chevron-right` icon
  4. **取消按钮**：`<Button variant='secondary' size='lg' block label='取消' style={{ marginTop: 14 }} />`（设计稿用 `.btn.secondary.xl.block`，对应 design 的 `variant='secondary' size='lg' block`）

- **平台按钮行为**：
  - 未安装：`hideUninstalled=true` 时不渲染该 Cell；否则 `Cell disabled` 置灰，点击 reject `E_PLATFORM_NOT_INSTALLED`
  - 点击有效平台：`bottomSheetRef.close()` → animation 完成回调里调对应 `shareXxx(payload)` → resolve openSheet 的 Promise
  - 时序考虑：先关 sheet 再调原生分享，避免 sheet 还在动画时 native 模态弹起冲突
- **取消**：点取消按钮 / 拖到底 / scrim 点击 → reject `E_USER_CANCEL`
- **暗色**：完全跟随 design `useTheme()`；设计稿暗色规约（grabber 颜色 / sheet 背景 / scrim 透明度）由 design tokens 自动 cover
- **不内置 toast**：openSheet resolve 出 `ShareResult`，业务自己决定是否 Toast（设计稿里的 toast 仅是 demo 模拟）

### 5.2.2 实现说明

`openSheet` 通过模块级 `ShareSheetController` 单例 + `<ShareSheetHost />` 挂载点管理：

```
openSheet(payload, options)
   │
   ├─ controller.show(payload, options)
   │   ├─ 通过 EventEmitter / useSyncExternalStore 通知挂载的 ShareSheetHost 渲染
   │   └─ ShareSheetHost 渲染 <BottomSheet snapPoints=['30%']> 内部包 Cell × N + Button(取消)
   │
   ├─ 用户点击平台按钮
   │   └─ ShareSheetHost 调用 shareLink/shareImage/shareText → 等回包 → controller.settle(result) → bottomSheetRef.close() → onClose 回调 resolve openSheet Promise
   │
   └─ 用户点取消/拖到底/scrim → bottomSheetRef.close() → onClose 回调 reject E_USER_CANCEL
```

**集成方需要**：

1. 安装 peerDependency：`@unif/react-native-design`、`@gorhom/bottom-sheet`、`react-native-gesture-handler`（任意一个已装就行，design 通常会带）
2. 根组件挂 `GestureHandlerRootView`（标准 RN 模板已有）+ `<ThemeProvider>`（design 系统提供）+ `<ShareSheetHost />`：

```tsx
// App.tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import { ShareSheetHost } from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationContainer>...</NavigationContainer>
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

### 5.3 Analytics

```ts
// src/analytics.ts
export function onEvent(eventId: string,
                        params?: Record<string, string | number>): void;
export function signIn(userId: string, provider?: string): void;
export function signOut(): void;
```

> **`reportError` 不暴露**：友盟统计 SDK 9.3.6+ 已经移除崩溃捕获能力（iOS 7.2.0+ 同样）；要崩溃捕获要另装 `com.umeng.umsdk:apm` (U-APM)，超出本桥范围。

调用样例：

```ts
import { Common, Analytics } from '@unif/react-native-umeng';

await Common.init();                                  // 隐私协议同意后
Analytics.onEvent('login', { channel: 'wechat' });
Analytics.signIn('user-123', 'wechat');
```

**Android**：`onEvent` 桥接到 `MobclickAgent.onEventObject(ctx, eventId, paramsMap)`（支持数值类型 value）。  
**iOS**：`onEvent` 桥接到 `MobClick.event(eventId, attributes:)`；iOS 端 value 强制 NSString（桥接层负责把 number 转字符串）。

> `Analytics` 上所有方法在 `Common.init()` 之前调用，原生 SDK 行为是：缓存或丢弃。本桥不抛 `E_NOT_INITIALIZED`，README 写明先 `Common.init()`。

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
implementation 'com.umeng.umsdk:common:9.9.1'         // 基础（含 UMConfigure / MobclickAgent）
implementation 'com.umeng.umsdk:asms:1.8.7.2'         // 必选基础组件
implementation 'com.umeng.umsdk:share-core:7.3.7'     // 分享核心
implementation 'com.umeng.umsdk:share-wx:7.3.7'       // 微信桥
implementation 'com.umeng.umsdk:share-dingding:7.3.7' // 钉钉桥

// 友盟 share-wx / share-dingding 不传递依赖于原生 SDK —— 必须显式声明
implementation 'com.tencent.mm.opensdk:wechat-sdk-android:6.8.34'
implementation 'com.alibaba.android:ddsharesdk:1.2.2'
```

> 版本号来源：Maven Central（`repo1.maven.org/maven2/com/umeng/umsdk/`、`com/tencent/mm/opensdk/`、`com/alibaba/android/ddsharesdk/`）当前最新稳定版（2026-05-26 实拉）。  
> **关键事实**：友盟 `share-*:7.3.7` 的 POM `<dependencies>` 实测为**空**，不会自动拉微信/钉钉官方 SDK，必须显式声明。

### 7.2 iOS（podspec）

```ruby
# ReactNativeUmeng.podspec
s.dependency 'UMCommon', '~> 7.5.10'           # 含 UMConfigure 和 MobClick（统计 API）
s.dependency 'UMDevice', '~> 3.6.0'            # 设备标识采集
s.dependency 'UMShare/Core', '~> 6.11.1'       # 分享核心
s.dependency 'UMShare/Social/WeChat', '~> 6.11.1'    # 微信（vendored WeChatSDK .a，无需单独装）
s.dependency 'UMShare/Social/DingDing', '~> 6.11.1'  # 钉钉（vendored DTShareKit.framework）

s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
s.pod_target_xcconfig = {
  "DEFINES_MODULE" => "YES",
  "SWIFT_VERSION" => "5.0",
  "CLANG_ENABLE_MODULES" => "YES",
  "OTHER_LDFLAGS" => "$(inherited) -ObjC"
}
install_modules_dependencies(s)
```

> **没有 UMAnalytics pod** — `MobClick.h` 已在 `UMCommon` 内（友盟新版命名后整合）。  
> **iOS / Android 版本号体系不同**：iOS UMShare 走 6.x（最新 6.11.1, 2026-01-07），Android share-* 走 7.x（最新 7.3.7），这是友盟在两端独立的版本号体系，**6.11.1 与 7.3.7 是同期版本、功能对齐**，不是 iOS 落后。  
> **`UMShare 6.11.1` podspec EXCLUDED_ARCHS 问题**：含 `EXCLUDED_ARCHS[sdk=iphonesimulator*]: arm64`，Apple Silicon 模拟器跑不起来。**宿主 Podfile** 需 `post_install` 清掉（见 §8.6）。

## 8. 集成方配置（README 写明）

### 8.1 iOS `Info.plist`

```xml
<!-- 友盟 appkey（iOS 端 appkey 通过代码传入，但本桥约定从 Info.plist 读以便宿主集中配置） -->
<key>UMENG_APPKEY</key>
<string>YOUR_UMENG_APPKEY</string>
<key>UMENG_CHANNEL</key>
<string>App Store</string>

<!-- 微信 -->
<key>UMENG_WECHAT_APPID</key>
<string>wxXXXXXXXX</string>
<key>UMENG_WECHAT_APPSECRET</key>
<string>XXXXXXXX</string>
<key>UMENG_WECHAT_UNIVERSAL_LINK</key>     <!-- 微信 SDK 1.8.6+ 强制 UL -->
<string>https://your.host/path/</string>

<!-- 钉钉 -->
<key>UMENG_DINGTALK_APPID</key>
<string>dingoaXXXXXXXX</string>

<!-- 跳转白名单 -->
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>weixin</string>
  <string>weixinULAPI</string>           <!-- 微信 1.8.6+ 强制 -->
  <string>weixinURLParamsAPI</string>
  <string>wechat</string>
  <string>dingtalk</string>
  <string>dingtalk-open</string>
  <string>dingtalk-sso</string>
</array>

<!-- 回调 URL Scheme -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>weixin</string>
    <key>CFBundleURLSchemes</key>
    <array><string>wxXXXXXXXX</string></array>   <!-- wx + 微信 AppID -->
  </dict>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>dingtalk</string>
    <key>CFBundleURLSchemes</key>
    <array><string>dingoaXXXXXXXX</string></array>  <!-- dingoa + 钉钉 AppID -->
  </dict>
</array>
```

### 8.2 iOS AppDelegate（README 模板）

```swift
// 1) handleOpenURL（iOS 9+ url scheme 回调）
func application(_ app: UIApplication, open url: URL,
                 options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
  if UmengBootstrap.shared.handleOpen(url, options: options) { return true }
  return false
}

// 2) Universal Link 回调（微信 1.8.6+ 强制需要）
func application(_ application: UIApplication,
                 continue userActivity: NSUserActivity,
                 restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
  return UmengBootstrap.shared.handleUniversalLink(userActivity)
}
```

`UmengBootstrap.shared.handleOpen` / `handleUniversalLink` 是本包导出的 Swift 静态方法，内部转发到 `UMSocialManager.default()?.handleOpen(_:options:)` / `handleUniversalLink(_:options:)`。

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
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>

<!-- Android 11+ 必须（包可见性查询，否则 isInstalled 始终 false） -->
<queries>
  <package android:name="com.tencent.mm" />
  <package android:name="com.alibaba.android.rimet" />
</queries>
```

### 8.4 Android 回调 Activity（集成方在自己包下创建）

#### 微信（继承友盟提供的基类，1 行空类）
```kotlin
// {appPkg}/wxapi/WXEntryActivity.kt
package com.example.app.wxapi

import com.umeng.socialize.weixin.view.WXCallbackActivity

class WXEntryActivity : WXCallbackActivity()
```

#### 钉钉（友盟未提供基类，必须自己实现 IDDAPIEventHandler）

> **关键差异**：与微信不同，友盟 7.3.7 **不提供** `DDShareCallbackActivity` 父类。开发者必须自己实现 `IDDAPIEventHandler`。

```kotlin
// {appPkg}/ddshare/DDShareActivity.kt
package com.example.app.ddshare

import android.app.Activity
import android.os.Bundle
import com.android.dingtalk.share.ddsharemodule.DDShareApiFactory
import com.android.dingtalk.share.ddsharemodule.IDDAPIEventHandler
import com.android.dingtalk.share.ddsharemodule.IDDShareApi
import com.android.dingtalk.share.ddsharemodule.message.BaseReq
import com.android.dingtalk.share.ddsharemodule.message.BaseResp

class DDShareActivity : Activity(), IDDAPIEventHandler {
  private lateinit var iddShareApi: IDDShareApi

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val appId = /* 读 Manifest meta-data UMENG_DINGTALK_APPID */
    iddShareApi = DDShareApiFactory.createDDShareApi(this, appId, false)
    iddShareApi.handleIntent(intent, this)
  }

  override fun onReq(req: BaseReq) { /* 钉钉分享一般不会触发 onReq */ }

  override fun onResp(resp: BaseResp) {
    // TODO: 透传给友盟 UMShareAPI（具体 API 在实施阶段验证 friend demo
    //   `umeng/MultiFunctionAndroidMavenDemo-master`）
    finish()
  }
}
```

#### Manifest 注册
```xml
<activity android:name=".wxapi.WXEntryActivity"
          android:configChanges="keyboardHidden|orientation|screenSize"
          android:exported="true"
          android:theme="@android:style/Theme.Translucent.NoTitleBar"/>

<activity android:name=".ddshare.DDShareActivity"
          android:configChanges="keyboardHidden|orientation|screenSize"
          android:exported="true"
          android:launchMode="singleInstance"
          android:theme="@android:style/Theme.Translucent.NoTitleBar"/>
```

`WXEntryActivity` 和 `DDShareActivity` 必须放在 `{applicationId}.wxapi.WXEntryActivity` / `{applicationId}.ddshare.DDShareActivity` —— 这是微信/钉钉 SDK 反射查找的固定位置，**不可改名**。

### 8.5 Android MainActivity 必须的转发（集成方）

```kotlin
class MainActivity : ReactActivity() {
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    UMShareAPI.get(this).onActivityResult(requestCode, resultCode, data)
  }

  override fun onDestroy() {
    super.onDestroy()
    UMShareAPI.get(this).release()
  }
}
```

> **没有这两个转发就拿不到分享回调**。RN 桥侧 `UmengShareModule` 通过 `reactApplicationContext.currentActivity` 拿到这个 Activity 后调 `ShareAction(activity).share()`。

### 8.6 宿主 Podfile（iOS）

```ruby
use_frameworks! :linkage => :static    # 强制 static — UMShare vendored .a，dynamic 会崩
use_modular_headers!                    # 必须 — 让 Swift 看到友盟 OC 头

target 'YourApp' do
  pod 'UMShare', :path => '...'
  pod 'UMCommon', :modular_headers => true  # 双保险，单独打开 OC 库的模块化头
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name.start_with?('UM')
      target.build_configurations.each do |config|
        # 清掉 UMShare 6.11.1 的 EXCLUDED_ARCHS=arm64 simulator，让 Apple Silicon Mac 模拟器跑起来
        config.build_settings.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
      end
    end
  end
end
```

### 8.7 Proguard（Android）

```pro
-dontwarn com.umeng.**
-keepattributes *Annotation*

-keep class com.umeng.** { *; }
-keep class com.uyumao.** { *; }
-keep class com.uc.** { *; }       # 友盟 9.3.0+ 必加
-keep class com.ut.** { *; }
-keep class com.ta.** { *; }

# 微信
-keep class com.tencent.mm.opensdk.** { *; }
-keep class com.tencent.wxop.** { *; }
-keep class com.tencent.mm.sdk.** { *; }

# 钉钉
-keep class com.alibaba.android.** { *; }

-keep public class **.R$* { public static final int *; }
-keepclassmembers class * { public <init> (org.json.JSONObject); }
-keepclassmembers enum * {
  public static **[] values();
  public static ** valueOf(java.lang.String);
}
```

## 9. 初始化流程（PIPL 合规）

两端流程**不同**（iOS SDK 没有 preInit），JS API 一致。

### 9.1 Android（两阶段）

```
App 冷启动
   │
   ▼
任一 TurboModule 构造（Common / Share / Analytics）
   └─ UmengBootstrap.ensurePreInit(ctx)         // 加锁单次
        ├─ 读 Manifest meta-data
        └─ UMConfigure.preInit(ctx, appkey, channel)
                                                ← 不采集、不上报，PIPL 合规
   ▼
JS 启动
   │
   ▼ 用户首次同意《隐私协议》
JS: await Common.init()
   │
   ▼ 原生 UmengCommonModule.init() → UmengBootstrap.ensureInit(ctx)
        ├─ UMConfigure.init(ctx, appkey, channel, DEVICE_TYPE_PHONE, "")
        ├─ PlatformConfig.setWeixin(appId, appSecret)
        └─ PlatformConfig.setDing(appId)
                                                ← 开始正式数据采集 + 分享回流
```

### 9.2 iOS（一阶段，未同意前不调任何 SDK API）

```
App 冷启动
   │
   ▼
TurboModule 构造        ← **不调任何友盟 API**（PIPL：未同意前不能 init）
   │
   ▼
JS 启动
   │
   ▼ 用户首次同意《隐私协议》
JS: await Common.init()
   │
   ▼ 原生 UmengCommonModule init: → UmengBootstrap.ensureInit()
        ├─ 读 Info.plist
        ├─ UMConfigure.initWithAppkey(appkey, channel: channel)
        ├─ UMSocialManager.default()?.setPlaform(.wechatSession, appKey:, appSecret:, redirectURL: nil)
        │   ↑ 注意拼写 setPlaform (SDK 源码错误，少一个 t)
        ├─ UMSocialManager.default()?.setPlaform(.dingDing, appKey:, appSecret: nil, redirectURL: nil)
        └─ UMSocialGlobal.shareInstance().universalLinkDic = [wechatSession.rawValue: UL]
                                                ← 开始正式数据采集 + 分享
```

### 9.3 公共要点
- **`Common.init()` 是 idempotent**：重复调仅触发一次原生 init，第二次立即 resolve
- **`Share.shareXxx` / `Share.openSheet`** 必须在 `Common.init()` 之后调用（iOS 端 init 前没有 setPlaform，会失败；Android 端 preInit 后 setPlatform 尚未跑，也会失败）
- **未 init 时的行为**：`Share` 操作 reject `E_NOT_INITIALIZED`；`Analytics` 操作友盟 SDK 内部丢弃（不抛错）

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

| ErrorCode | 触发条件 | iOS 检测点 | Android 检测点 |
| --- | --- | --- | --- |
| `E_PLATFORM_NOT_INSTALLED` | 微信/钉钉未安装 | `UIApplication.shared.canOpenURL("weixin://"/"dingtalk://")` 探测；友盟错误码 2008 兜底 | `UMShareAPI.get(ctx).isInstall(activity, platform)` |
| `E_PLATFORM_NOT_SUPPORTED` | platform 字串不在白名单 | TS facade + 原生 enum 校验 | 同左 |
| `E_INVALID_OPTIONS` | 必填字段缺失 / URL 格式错 | TS facade 优先；原生兜底 | 同左 |
| `E_USER_CANCEL` | 用户取消 | `error.domain == UMSocialPlatformErrorDomain && error.code == 2009` | `UMShareListener.onCancel(platform)` 回调 |
| `E_SHARE_FAILED` | 友盟回调 fail | `error.code == 2003 / 2007 / 2010 / 2011 / 其它` | `UMShareListener.onError(platform, throwable)` — Android 无结构化错误码，只能透出 `throwable.message` |
| `E_NOT_INITIALIZED` | `Common.init()` 未调用就调 share | `UmengBootstrap.isInited == false` | 同左 |
| `E_UNKNOWN` | 其它 | catch-all | catch-all |

> **iOS 友盟方法名拼写注意**：`setPlaform`（少一个 t）是 SDK 源码错误，沿用至今；调用时必须照错误拼写写。

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
│   │   ├── ShareSheetHost.tsx        ← Host，内部用 design 的 <BottomSheet> + <Cell> + <Button>
│   │   ├── ShareSheetController.ts   ← 单例：openSheet/dismiss + EventEmitter
│   │   ├── PlatformLeading.tsx       ← 32×32 圆角品牌色方块 + 白色 glyph 容器
│   │   ├── WeChatGlyph.tsx           ← react-native-svg 画的白色微信 glyph
│   │   └── DingTalkGlyph.tsx         ← react-native-svg 画的白色钉钉 glyph
├── src/__tests__/
│   ├── common.test.ts
│   ├── share.test.ts
│   ├── share-sheet.test.tsx
│   └── analytics.test.ts
├── ios/                                ← 每个 module 三件套 + 共享 helper
│   ├── UmengCommon.h
│   ├── UmengCommon.mm                  ← ObjC++ shim，符合 NativeUmengCommonSpec
│   ├── UmengCommonImpl.swift           ← Swift 业务（@objcMembers public class）
│   ├── UmengShare.h
│   ├── UmengShare.mm
│   ├── UmengShareImpl.swift
│   ├── UmengAnalytics.h
│   ├── UmengAnalytics.mm
│   ├── UmengAnalyticsImpl.swift
│   └── UmengBootstrap.swift            ← 共享单例（iOS 端）
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
3. Android：`UmengBootstrap` + `UmengCommonModule` + `UmengShareModule` + `UmengAnalyticsModule` + `ReactNativeUmengPackage`，gradle 依赖（含显式声明 wechat-sdk-android + ddsharesdk）
4. iOS：每个 module 三件套（`.h` + `.mm` + `Impl.swift`）+ `UmengBootstrap.swift` 共享单例；podspec 依赖 UMCommon + UMShare/Core + WeChat/DingDing subspec
5. **ShareSheet（RN, 用 @unif/react-native-design，list variant）**：`ShareSheetController` 单例 + `ShareSheetHost`（内部用 design `BottomSheet`+`Cell`+`Button`）+ `WeChatGlyph` / `DingTalkGlyph`（react-native-svg 内联，path 直接搬设计稿）+ `PlatformLeading`（32×32 品牌色方块）+ 组件单测；example/package.json 加 `@unif/react-native-design` 的 portal: 引用
6. example：根挂 `GestureHandlerRootView` + `ThemeProvider` + `<ShareSheetHost />`；2 common + 4 分享（openSheet 主用例 + 1 个直拉）+ 3 统计按钮（onEvent / signIn / signOut，无 reportError）
7. README：宿主 App 集成步骤（plist / Manifest / WXEntryActivity / **自实现的** DDShareActivity / MainActivity onActivityResult 转发 / Podfile post_install 清 EXCLUDED_ARCHS / use_modular_headers + use_frameworks linkage static / AppDelegate handleOpenURL + Universal Link 回调）
6. README：宿主 App 集成步骤（plist、Manifest、WXEntryActivity / DDShareActivity 模板、AppDelegate handleOpenURL）
7. 真机回归

## 15. 风险与待确认

### 已知重大风险

- **iOS UMShare 6.11.1 `EXCLUDED_ARCHS=arm64` 模拟器**：宿主 Podfile 必须 `post_install` 清掉（spec §8.6 已写代码），否则 Apple Silicon Mac 上 simulator 跑不起来
- **iOS `use_frameworks!` 限制**：UMShare vendored `.a` 文件，宿主 Podfile 必须 `use_frameworks! :linkage => :static`（或不写），用 dynamic 会崩；同时必须 `use_modular_headers!` 才能在 Swift 里 `import UMCommon`
- **iOS 友盟方法名拼写错误**：`UMSocialManager.default()?.setPlaform(...)`（少一个 t）是 SDK 源码沿用至今的拼写错误，**桥实现时必须按错的拼写写**
- **Android 钉钉回调 Activity** 友盟未提供基类，必须按 §8.4 模板自实现 `IDDAPIEventHandler`；`onResp` 内透传给 `UMShareAPI` 的具体方法需要实施时打开 [`umeng/MultiFunctionAndroidMavenDemo-master`](https://github.com/umeng/MultiFunctionAndroidMavenDemo-master) demo 验证
- **Android 必须 `onActivityResult` / `onDestroy` 转发**：见 §8.5；集成方不做这个，所有分享回调都收不到
- **Android 微信/钉钉 SDK 不传递依赖**：见 §7.1；必须显式声明 `wechat-sdk-android:6.8.34` + `ddsharesdk:1.2.2`
- **微信 Universal Link 强制**：iOS 微信 SDK 1.8.6+ 起强制 UL；宿主 App 必须开启 Associated Domains + 部署 `apple-app-site-association`，否则微信跳回会闪退

### 待实施时验证

- **钉钉 `DDShareActivity.onResp` 透传方式**：友盟 demo 中具体怎么把回调发给 `UMShareAPI`（API 名）
- **iOS `setPlaform` 拼写**是否在 6.11.1 仍存在（极大概率是；底层 framework 头文件未更新）
- **iOS `isInstall(platformType:)` 公开 API** 是否存在；保守用 `UIApplication.canOpenURL`
- **Android U-App 9.x 是否需要 `READ_PHONE_STATE`**：U-App 文档列了，share-* 7.3.7 文档说不需要 —— 矛盾，实施时取并集观察
- **微信 6.8.34 与 友盟 share-wx 7.3.7 兼容性**：友盟 demo 用 6.8.24，maven 最新 6.8.34

### 其他约束

- **隐私协议** 文案不在本包范围；本包仅控制 `Common.init()` 调用时机
- **`<ShareSheetHost />` 单例假设**：要求集成方根组件挂一个，多次挂载行为未定义；Host 内部用 `useId` 注册表 + dev 多挂 warning
- **设计系统依赖**：ShareSheet UI 用 `@unif/react-native-design` 的 `BottomSheet`/`Cell`/`Button` 实现。宿主 App 必须包 `<ThemeProvider>`（来自 design 系统）和 `<GestureHandlerRootView>`（标准 RN 模板已有），否则 UI 报错。`@unif/react-native-design` 当前最低 0.1.2
- **微信/钉钉品牌 glyph**：design 系统不含品牌图标；本包用 `react-native-svg` 画 path（直接搬设计稿 `share-panel.jsx` 的 `WeChatGlyph` / `DingTalkGlyph`），白色填充叠在品牌色方块上。设计稿 chat 作者已说明 glyph 是手绘近似而非官方 brand asset；如商务/法务要求必须用官方 logo 替换，再单独切到官方 SVG
- **variant 单一**：v1 只实现 list variant。如未来要补 tiles（2 列大卡片）/ grid（5 列网格），设计稿 `share-panel.jsx` 已含完整布局可直接搬

---

设计文档完，等用户审阅后转入 writing-plans。
