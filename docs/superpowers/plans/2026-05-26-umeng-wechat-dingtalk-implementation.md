# @unif/react-native-umeng 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 `react-native-umshare` turbo-module 模板改造成 `@unif/react-native-umeng` — 集成友盟 U-App 移动统计、U-Share 微信会话/钉钉分享，提供 RN 命令式 ShareSheet 面板。

**Architecture:** 三个独立 TurboModule（`UmengCommon` / `UmengShare` / `UmengAnalytics`）共享 `UmengBootstrap` 单例做 preInit/init；JS 侧导出 namespace API；ShareSheet UI 基于 `@unif/react-native-design` 的 `BottomSheet`/`Cell`/`Button`；iOS 用 ObjC++ shim + Swift Adapter Pattern；Android 用 Kotlin。

**Tech Stack:** React Native 0.85.3 turbo-module、TypeScript、Kotlin、Swift + ObjC++、友盟 SDK（iOS UMCommon 7.5.10 + UMShare 6.11.1；Android com.umeng.umsdk:common 9.9.1 + share-* 7.3.7）、微信 wechat-sdk-android 6.8.34、钉钉 ddsharesdk 1.2.2、@unif/react-native-design 0.1.2、@gorhom/bottom-sheet 5、react-native-gesture-handler 2.21、react-native-svg 15。

**Spec:** `docs/superpowers/specs/2026-05-26-umeng-wechat-dingtalk-design.md`  
**Research notes:** `docs/superpowers/specs/2026-05-26-umeng-research-notes.md`  
**Design refs:** `docs/superpowers/design-refs/share-panel/`（含品牌 SVG）

---

## File Structure（实施时创建/修改）

### 新建文件
```
src/
  types.ts                          # Platform enum, ShareResult, ErrorCode, SUPPORTED_PLATFORMS, ShareSheetPayload/Options
  NativeUmengCommon.ts              # TurboModule spec
  NativeUmengShare.ts               # TurboModule spec
  NativeUmengAnalytics.ts           # TurboModule spec
  common.ts                         # JS Common facade
  share.ts                          # JS Share facade（含 openSheet 命令式 API）
  analytics.ts                      # JS Analytics facade
  ShareSheet/
    ShareSheetHost.tsx              # Modal Host 组件
    ShareSheetController.ts         # 单例 + EventEmitter
    PlatformLeading.tsx             # 32×32 圆角块容器
    WeChatGlyph.tsx                 # SimpleIcons 单 path 白色
    DingTalkGlyph.tsx               # 钉钉官方 4 path 蓝色渐变
  __tests__/
    types.test.ts
    common.test.ts
    share.test.ts
    analytics.test.ts
    ShareSheetController.test.ts
    ShareSheetHost.test.tsx

ios/
  UmengCommon.h / .mm / UmengCommonImpl.swift
  UmengShare.h / .mm / UmengShareImpl.swift
  UmengAnalytics.h / .mm / UmengAnalyticsImpl.swift
  UmengBootstrap.swift              # 共享 helper

android/src/main/java/com/unif/reactnativeumeng/
  UmengCommonModule.kt
  UmengShareModule.kt
  UmengAnalyticsModule.kt
  UmengBootstrap.kt
  ReactNativeUmengPackage.kt
```

### 修改文件
```
package.json                        # 包名/codegen/peer/dev deps
ReactNativeUmeng.podspec            # 改名 + 加友盟依赖（重命名自 ReactNativeUmshare.podspec）
android/build.gradle                # 包名 + 友盟/微信/钉钉依赖
example/package.json                # 加 design + bottom-sheet + gesture-handler + svg
example/src/App.tsx                 # 根挂 ShareSheetHost，验证矩阵按钮
README.md                           # 宿主集成说明（plist/Manifest/Activity/Podfile/Proguard）
.github/ISSUE_TEMPLATE/config.yml   # 已对，无需再改
```

### 删除文件
```
src/multiply.tsx
src/multiply.native.tsx
src/NativeReactNativeUmshare.ts
src/__tests__/index.test.tsx
ios/ReactNativeUmshare.h
ios/ReactNativeUmshare.mm
android/src/main/java/com/unif/reactnativeumshare/  # 整个目录
ReactNativeUmshare.podspec          # mv 成 ReactNativeUmeng.podspec
```

### 目录改名
`/Users/liulijun/tongyi/unif/react-native-umshare/` → `/Users/liulijun/tongyi/unif/react-native-umeng/`（git mv 保留历史）

---

## 阶段 1 · 改名与项目骨架

### Task 1: 重命名包与目录、清空旧 turbo-module 模板代码

**Files:**
- Rename (parent dir): `react-native-umshare/` → `react-native-umeng/`
- Modify: `package.json`
- Rename: `ReactNativeUmshare.podspec` → `ReactNativeUmeng.podspec`
- Rename: `android/src/main/java/com/unif/reactnativeumshare/` → `android/src/main/java/com/unif/reactnativeumeng/`
- Delete: `src/multiply.tsx`, `src/multiply.native.tsx`, `src/NativeReactNativeUmshare.ts`, `src/__tests__/index.test.tsx`（如有）, `ios/ReactNativeUmshare.h`, `ios/ReactNativeUmshare.mm`, 旧 Android `.kt` 文件
- Modify: `src/index.tsx` → 暂留空骨架（task 7 重写）

- [ ] **Step 1: 父目录改名**

```bash
cd /Users/liulijun/tongyi/unif
mv react-native-umshare react-native-umeng
cd react-native-umeng
pwd
```

Expected output: `/Users/liulijun/tongyi/unif/react-native-umeng`

> 注意：`git mv` 不能跨仓库根改名整个仓库目录；这里目录改名不会丢 git 历史，因为 `.git` 是仓库根的隐藏目录，跟着 mv 一起走。

- [ ] **Step 2: 用 git mv 改 podspec 文件名**

```bash
git mv ReactNativeUmshare.podspec ReactNativeUmeng.podspec
```

- [ ] **Step 3: 用 git mv 改 Android 包目录**

```bash
git mv android/src/main/java/com/unif/reactnativeumshare android/src/main/java/com/unif/reactnativeumeng
```

- [ ] **Step 4: 删除旧 turbo-module 模板的 multiply / native / 测试**

```bash
git rm src/multiply.tsx src/multiply.native.tsx src/NativeReactNativeUmshare.ts
git rm -rf src/__tests__ 2>/dev/null || true
git rm ios/ReactNativeUmshare.h ios/ReactNativeUmshare.mm
git rm android/src/main/java/com/unif/reactnativeumeng/ReactNativeUmshareModule.kt
git rm android/src/main/java/com/unif/reactnativeumeng/ReactNativeUmsharePackage.kt
git status -s | head -20
```

- [ ] **Step 5: 重写 package.json**

替换整个文件内容为：

```json
{
  "name": "@unif/react-native-umeng",
  "version": "0.1.0",
  "description": "友盟 React Native bridge: U-Share(WeChat/DingTalk) + U-App Analytics (@unif 私有)",
  "main": "./lib/module/index.js",
  "types": "./lib/typescript/src/index.d.ts",
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./lib/typescript/src/index.d.ts",
      "default": "./lib/module/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "src",
    "lib",
    "android",
    "ios",
    "*.podspec",
    "react-native.config.js",
    "!ios/build",
    "!android/build",
    "!android/gradle",
    "!android/gradlew",
    "!android/gradlew.bat",
    "!android/local.properties",
    "!**/__tests__",
    "!**/__fixtures__",
    "!**/__mocks__",
    "!**/.*"
  ],
  "scripts": {
    "example": "yarn workspace @unif/react-native-umeng-example",
    "clean": "del-cli android/build example/android/build example/android/app/build example/ios/build lib",
    "prepare": "bob build",
    "typecheck": "tsc",
    "lint": "eslint \"**/*.{js,ts,tsx}\"",
    "test": "jest"
  },
  "keywords": ["react-native", "ios", "android", "umeng", "share", "analytics"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/unif-design/react-native-umeng.git"
  },
  "author": "unif-design <382724935@qq.com> (https://github.com/unif-design)",
  "license": "MIT",
  "bugs": { "url": "https://github.com/unif-design/react-native-umeng/issues" },
  "homepage": "https://github.com/unif-design/react-native-umeng#readme",
  "publishConfig": { "registry": "https://npm.unif.internal" },
  "devDependencies": {
    "@eslint/compat": "^2.0.3",
    "@eslint/eslintrc": "^3.3.5",
    "@eslint/js": "^10.0.1",
    "@gorhom/bottom-sheet": "^5.2.14",
    "@react-native/babel-preset": "0.85.3",
    "@react-native/eslint-config": "0.85.0",
    "@react-native/jest-preset": "0.85.3",
    "@types/jest": "^29.5.14",
    "@types/react": "^19.2.0",
    "@unif/react-native-design": "portal:../react-native-design",
    "del-cli": "^7.0.0",
    "eslint": "^9.39.4",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-ft-flow": "^3.0.11",
    "eslint-plugin-prettier": "^5.5.5",
    "jest": "^29.7.0",
    "prettier": "^3.8.1",
    "react": "19.2.3",
    "react-native": "0.85.3",
    "react-native-builder-bob": "^0.41.0",
    "react-native-gesture-handler": "^2.21.0",
    "react-native-svg": "^15.15.5",
    "turbo": "^2.8.21",
    "typescript": "^6.0.2"
  },
  "peerDependencies": {
    "@gorhom/bottom-sheet": ">=5",
    "@unif/react-native-design": ">=0.1.2",
    "react": "*",
    "react-native": "*",
    "react-native-gesture-handler": ">=2.21.0",
    "react-native-svg": ">=15"
  },
  "workspaces": ["example"],
  "packageManager": "yarn@4.11.0",
  "react-native-builder-bob": {
    "source": "src",
    "output": "lib",
    "targets": [
      ["module", { "esm": true }],
      ["typescript", { "project": "tsconfig.build.json" }]
    ]
  },
  "codegenConfig": {
    "name": "ReactNativeUmengSpec",
    "type": "modules",
    "jsSrcsDir": "src"
  },
  "jest": {
    "preset": "@react-native/jest-preset",
    "modulePathIgnorePatterns": ["<rootDir>/example/node_modules", "<rootDir>/lib/"]
  },
  "prettier": {
    "quoteProps": "consistent",
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5",
    "useTabs": false
  },
  "create-react-native-library": {
    "type": "turbo-module",
    "languages": "kotlin-objc",
    "tools": ["eslint", "jest"],
    "version": "0.62.0"
  }
}
```

- [ ] **Step 6: 改 example/package.json 名字 + 引用**

打开 `example/package.json`，把 `"name": "@unif/react-native-umshare-example"` 改成 `"name": "@unif/react-native-umeng-example"`。把 dependencies 中 `"@unif/react-native-umshare"` 改成 `"@unif/react-native-umeng"`（如有则改；如无则在 example task 阶段会添加）。

- [ ] **Step 7: 把 src/index.tsx 替换成空骨架（task 7 重写）**

替换 `src/index.tsx` 内容为：

```ts
// 占位文件 —— task 7 将替换为完整 namespace 导出
export {};
```

> 注：稍后改名为 `src/index.ts`（task 7）。

- [ ] **Step 8: 验证 git status**

```bash
git status -s
```

Expected: 看到一系列 `R`（重命名）和 `D`（删除）和 `M`（修改），没有 untracked 的旧文件残留。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: rename to @unif/react-native-umeng and scrub turbo-module template"
```

---

### Task 2: 修改 ReactNativeUmeng.podspec 改名

**Files:**
- Modify: `ReactNativeUmeng.podspec`

- [ ] **Step 1: 改 podspec 里所有的 ReactNativeUmshare 字面量**

替换整个 `ReactNativeUmeng.podspec` 内容为：

```ruby
require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeUmeng"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/unif-design/react-native-umeng.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "SWIFT_VERSION" => "5.0",
    "CLANG_ENABLE_MODULES" => "YES",
    "OTHER_LDFLAGS" => "$(inherited) -ObjC"
  }

  # 友盟基础 + 分享
  s.dependency "UMCommon", "~> 7.5.10"
  s.dependency "UMDevice", "~> 3.6.0"
  s.dependency "UMShare/Core", "~> 6.11.1"
  s.dependency "UMShare/Social/WeChat", "~> 6.11.1"
  s.dependency "UMShare/Social/DingDing", "~> 6.11.1"

  install_modules_dependencies(s)
end
```

- [ ] **Step 2: Commit**

```bash
git add ReactNativeUmeng.podspec
git commit -m "feat(ios): podspec ReactNativeUmeng with UMCommon + UMShare deps"
```

---

### Task 3: 修改 android/build.gradle 改包名与加友盟依赖

**Files:**
- Modify: `android/build.gradle`

- [ ] **Step 1: 替换整个 android/build.gradle 内容**

读当前文件：

```bash
cat android/build.gradle
```

替换内容为：

```gradle
buildscript {
  ext.getExtOrDefault = { name ->
    return rootProject.ext.has(name)
      ? rootProject.ext.get(name)
      : project.properties["ReactNativeUmeng_" + name]
  }

  repositories {
    google()
    mavenCentral()
  }

  dependencies {
    classpath "com.android.tools.build:gradle:8.7.2"
    classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:${getExtOrDefault("kotlinVersion") ?: '2.1.20'}"
  }
}

apply plugin: "com.android.library"
apply plugin: "org.jetbrains.kotlin.android"

def reactNativeArchitectures() {
  def value = rootProject.getProperties().get("reactNativeArchitectures")
  return value ? value.split(",") : ["armeabi-v7a", "x86", "x86_64", "arm64-v8a"]
}

android {
  namespace "com.unif.reactnativeumeng"
  compileSdkVersion (getExtOrDefault("compileSdkVersion") as Integer) ?: 35

  defaultConfig {
    minSdkVersion (getExtOrDefault("minSdkVersion") as Integer) ?: 24
    targetSdkVersion (getExtOrDefault("targetSdkVersion") as Integer) ?: 34
  }

  buildFeatures { buildConfig true }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
  }

  kotlinOptions { jvmTarget = "17" }

  sourceSets.main.java.srcDirs += [
    "generated/java",
    "generated/jni",
  ]
}

repositories {
  mavenCentral()
  google()
}

dependencies {
  implementation "com.facebook.react:react-android"

  // 友盟基础
  implementation "com.umeng.umsdk:common:9.9.1"
  implementation "com.umeng.umsdk:asms:1.8.7.2"

  // U-Share
  implementation "com.umeng.umsdk:share-core:7.3.7"
  implementation "com.umeng.umsdk:share-wx:7.3.7"
  implementation "com.umeng.umsdk:share-dingding:7.3.7"

  // 微信 / 钉钉官方 SDK（友盟不传递依赖，必须显式）
  implementation "com.tencent.mm.opensdk:wechat-sdk-android:6.8.34"
  implementation "com.alibaba.android:ddsharesdk:1.2.2"
}
```

- [ ] **Step 2: 创建 AndroidManifest.xml（如不存在）**

```bash
ls android/src/main/AndroidManifest.xml 2>&1
```

若不存在，创建 `android/src/main/AndroidManifest.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
</manifest>
```

> 库的 Manifest 不放 meta-data / Activity — 那些是宿主 App 的责任，README 写明。

- [ ] **Step 3: Commit**

```bash
git add android/build.gradle android/src/main/AndroidManifest.xml
git commit -m "feat(android): build.gradle with Umeng/WeChat/DingTalk deps"
```

---

## 阶段 2 · JS 层（types / spec / facade）

### Task 4: 写 src/types.ts

**Files:**
- Create: `src/types.ts`
- Create: `src/__tests__/types.test.ts`

- [ ] **Step 1: 写 src/types.ts**

创建 `src/types.ts`：

```ts
/** 本桥首版支持的分享目标平台 */
export enum Platform {
  WECHAT_SESSION = 'wechat_session',
  DINGTALK = 'dingtalk',
}

/** 默认渲染顺序 */
export const SUPPORTED_PLATFORMS: ReadonlyArray<Platform> = [
  Platform.WECHAT_SESSION,
  Platform.DINGTALK,
];

export interface PlatformInfo {
  platform: Platform;
  installed: boolean;
  displayName: string;
}

export const PLATFORM_DISPLAY_NAMES: Readonly<Record<Platform, string>> = {
  [Platform.WECHAT_SESSION]: '微信',
  [Platform.DINGTALK]: '钉钉',
};

export const PLATFORM_DEFAULT_SUBTITLES: Readonly<Record<Platform, string>> = {
  [Platform.WECHAT_SESSION]: '发送给好友或群',
  [Platform.DINGTALK]: '发送至工作群',
};

export type ShareCode = 'success' | 'cancel' | 'failed';

export interface ShareResult {
  code: ShareCode;
  message?: string;
  platform: Platform;
}

export type ErrorCode =
  | 'E_PLATFORM_NOT_INSTALLED'
  | 'E_PLATFORM_NOT_SUPPORTED'
  | 'E_INVALID_OPTIONS'
  | 'E_USER_CANCEL'
  | 'E_SHARE_FAILED'
  | 'E_NOT_INITIALIZED'
  | 'E_UNKNOWN';

export class UmengError extends Error {
  readonly code: ErrorCode;
  readonly nativeError?: unknown;
  constructor(code: ErrorCode, message: string, nativeError?: unknown) {
    super(message);
    this.name = 'UmengError';
    this.code = code;
    this.nativeError = nativeError;
  }
}

export interface ShareTextOptions {
  platform: Platform;
  text: string;
}

export interface ShareImageOptions {
  platform: Platform;
  image: string;
  thumb?: string;
}

export interface ShareLinkOptions {
  platform: Platform;
  title: string;
  url: string;
  description?: string;
  thumb?: string;
}

export type ShareSheetPayload =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; thumb?: string }
  | { type: 'link'; title: string; url: string; description?: string; thumb?: string };

export interface ShareSheetOptions {
  /** 面板标题，默认 '分享至' */
  title?: string;
  /** 取消按钮文案，默认 '取消' */
  cancelText?: string;
  /** 平台副标题覆盖；默认见 PLATFORM_DEFAULT_SUBTITLES */
  subtitles?: Partial<Record<Platform, string>>;
  /** 未安装平台隐藏；默认 false（按钮置灰） */
  hideUninstalled?: boolean;
}
```

- [ ] **Step 2: 写测试 src/__tests__/types.test.ts**

```ts
import {
  Platform,
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DEFAULT_SUBTITLES,
  UmengError,
} from '../types';

describe('types', () => {
  it('Platform enum values are stable', () => {
    expect(Platform.WECHAT_SESSION).toBe('wechat_session');
    expect(Platform.DINGTALK).toBe('dingtalk');
  });

  it('SUPPORTED_PLATFORMS contains exactly two entries in render order', () => {
    expect(SUPPORTED_PLATFORMS).toEqual([
      Platform.WECHAT_SESSION,
      Platform.DINGTALK,
    ]);
  });

  it('every supported platform has a display name and default subtitle', () => {
    for (const p of SUPPORTED_PLATFORMS) {
      expect(PLATFORM_DISPLAY_NAMES[p]).toBeTruthy();
      expect(PLATFORM_DEFAULT_SUBTITLES[p]).toBeTruthy();
    }
  });

  it('UmengError carries code and message', () => {
    const e = new UmengError('E_USER_CANCEL', 'cancelled');
    expect(e.code).toBe('E_USER_CANCEL');
    expect(e.message).toBe('cancelled');
    expect(e.name).toBe('UmengError');
    expect(e).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 3: 跑测试，看通过**

```bash
yarn test src/__tests__/types.test.ts
```

Expected: 4 个测试全 PASS。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/__tests__/types.test.ts
git commit -m "feat(js): types — Platform enum, ShareResult, UmengError, options"
```

---

### Task 5: 写三个 TurboModule spec（codegen 入口）

**Files:**
- Create: `src/NativeUmengCommon.ts`
- Create: `src/NativeUmengShare.ts`
- Create: `src/NativeUmengAnalytics.ts`

- [ ] **Step 1: 写 NativeUmengCommon.ts**

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  init(): Promise<void>;
  isInited(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengCommon');
```

- [ ] **Step 2: 写 NativeUmengShare.ts**

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface NativeShareResult {
  code: string;       // 'success' | 'cancel' | 'failed'
  message?: string;
  platform: string;
}

export interface Spec extends TurboModule {
  shareText(platform: string, text: string): Promise<NativeShareResult>;
  shareImage(platform: string, image: string, thumb?: string): Promise<NativeShareResult>;
  shareLink(
    platform: string,
    title: string,
    url: string,
    description?: string,
    thumb?: string
  ): Promise<NativeShareResult>;
  isInstalled(platform: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengShare');
```

- [ ] **Step 3: 写 NativeUmengAnalytics.ts**

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

- [ ] **Step 4: 跑 typecheck**

```bash
yarn typecheck
```

Expected: 无类型错。`TurboModuleRegistry.getEnforcing` 是 RN 标准 API，TS 应认得。

- [ ] **Step 5: Commit**

```bash
git add src/NativeUmengCommon.ts src/NativeUmengShare.ts src/NativeUmengAnalytics.ts
git commit -m "feat(js): codegen specs for UmengCommon/Share/Analytics TurboModules"
```

---

### Task 6: 写 src/common.ts + 单测

**Files:**
- Create: `src/common.ts`
- Create: `src/__tests__/common.test.ts`
- Create: `src/__tests__/__mocks__/NativeUmengCommon.ts`（jest mock）

- [ ] **Step 1: 写 jest mock 文件**

创建 `src/__tests__/__mocks__/NativeUmengCommon.ts`：

```ts
const NativeUmengCommon = {
  init: jest.fn().mockResolvedValue(undefined),
  isInited: jest.fn().mockResolvedValue(false),
};

export default NativeUmengCommon;
```

- [ ] **Step 2: 写测试 src/__tests__/common.test.ts**

```ts
jest.mock('../NativeUmengCommon');

import NativeUmengCommon from '../NativeUmengCommon';
import * as Common from '../common';

describe('Common', () => {
  beforeEach(() => {
    (NativeUmengCommon.init as jest.Mock).mockClear();
    (NativeUmengCommon.isInited as jest.Mock).mockClear();
    Common.__resetForTests();
  });

  it('init resolves and is idempotent (native called once)', async () => {
    await Common.init();
    await Common.init();
    expect(NativeUmengCommon.init).toHaveBeenCalledTimes(1);
  });

  it('isInited delegates to native', async () => {
    (NativeUmengCommon.isInited as jest.Mock).mockResolvedValueOnce(true);
    await expect(Common.isInited()).resolves.toBe(true);
    expect(NativeUmengCommon.isInited).toHaveBeenCalledTimes(1);
  });

  it('init propagates native errors', async () => {
    const err = new Error('boom');
    (NativeUmengCommon.init as jest.Mock).mockRejectedValueOnce(err);
    await expect(Common.init()).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 3: 跑测试，看失败**

```bash
yarn test src/__tests__/common.test.ts
```

Expected: FAIL — `Common.init` 不存在。

- [ ] **Step 4: 写实现 src/common.ts**

```ts
import NativeUmengCommon from './NativeUmengCommon';

let initPromise: Promise<void> | null = null;

/** 启动友盟数据采集（用户同意《隐私协议》后调）。idempotent — 重复调只触发一次原生 init。 */
export function init(): Promise<void> {
  if (initPromise === null) {
    initPromise = NativeUmengCommon.init().catch((err) => {
      initPromise = null; // 失败后允许重试
      throw err;
    });
  }
  return initPromise;
}

/** 查询是否已完成 init。 */
export function isInited(): Promise<boolean> {
  return NativeUmengCommon.isInited();
}

/** @internal 仅给 jest 用 */
export function __resetForTests(): void {
  initPromise = null;
}
```

- [ ] **Step 5: 跑测试，看通过**

```bash
yarn test src/__tests__/common.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/common.ts src/__tests__/common.test.ts src/__tests__/__mocks__/NativeUmengCommon.ts
git commit -m "feat(js): Common.init/isInited with idempotent Promise caching"
```

---

### Task 7: 写 src/share.ts 底层 API + 单测（openSheet 留到 task 20）

**Files:**
- Create: `src/share.ts`
- Create: `src/__tests__/share.test.ts`
- Create: `src/__tests__/__mocks__/NativeUmengShare.ts`

- [ ] **Step 1: 写 jest mock**

创建 `src/__tests__/__mocks__/NativeUmengShare.ts`：

```ts
const NativeUmengShare = {
  shareText: jest.fn(),
  shareImage: jest.fn(),
  shareLink: jest.fn(),
  isInstalled: jest.fn(),
};

export default NativeUmengShare;
```

- [ ] **Step 2: 写测试**

`src/__tests__/share.test.ts`：

```ts
jest.mock('../NativeUmengShare');

import NativeUmengShare from '../NativeUmengShare';
import * as Share from '../share';
import { Platform, UmengError } from '../types';

describe('Share', () => {
  beforeEach(() => {
    (NativeUmengShare.shareText as jest.Mock).mockReset();
    (NativeUmengShare.shareImage as jest.Mock).mockReset();
    (NativeUmengShare.shareLink as jest.Mock).mockReset();
    (NativeUmengShare.isInstalled as jest.Mock).mockReset();
  });

  describe('shareText', () => {
    it('forwards platform + text to native and returns ShareResult', async () => {
      (NativeUmengShare.shareText as jest.Mock).mockResolvedValue({
        code: 'success',
        message: 'ok',
        platform: 'wechat_session',
      });
      const r = await Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' });
      expect(NativeUmengShare.shareText).toHaveBeenCalledWith('wechat_session', 'hi');
      expect(r).toEqual({ code: 'success', message: 'ok', platform: Platform.WECHAT_SESSION });
    });

    it('rejects E_INVALID_OPTIONS when text is empty', async () => {
      await expect(
        Share.shareText({ platform: Platform.WECHAT_SESSION, text: '' })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    });

    it('rejects E_PLATFORM_NOT_SUPPORTED for unknown platform', async () => {
      await expect(
        Share.shareText({ platform: 'unknown' as Platform, text: 'hi' })
      ).rejects.toMatchObject({ code: 'E_PLATFORM_NOT_SUPPORTED' });
    });

    it('maps native cancel to UmengError E_USER_CANCEL', async () => {
      (NativeUmengShare.shareText as jest.Mock).mockResolvedValue({
        code: 'cancel',
        message: 'user cancelled',
        platform: 'wechat_session',
      });
      await expect(
        Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' })
      ).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
    });

    it('maps native failed to UmengError E_SHARE_FAILED', async () => {
      (NativeUmengShare.shareText as jest.Mock).mockResolvedValue({
        code: 'failed',
        message: 'something broke',
        platform: 'wechat_session',
      });
      await expect(
        Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' })
      ).rejects.toMatchObject({ code: 'E_SHARE_FAILED', message: 'something broke' });
    });
  });

  describe('shareImage', () => {
    it('forwards optional thumb', async () => {
      (NativeUmengShare.shareImage as jest.Mock).mockResolvedValue({
        code: 'success', platform: 'dingtalk',
      });
      await Share.shareImage({ platform: Platform.DINGTALK, image: 'https://x/a.png', thumb: 'https://x/t.png' });
      expect(NativeUmengShare.shareImage).toHaveBeenCalledWith('dingtalk', 'https://x/a.png', 'https://x/t.png');
    });

    it('rejects E_INVALID_OPTIONS when image is empty', async () => {
      await expect(
        Share.shareImage({ platform: Platform.WECHAT_SESSION, image: '' })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    });
  });

  describe('shareLink', () => {
    it('forwards all fields', async () => {
      (NativeUmengShare.shareLink as jest.Mock).mockResolvedValue({
        code: 'success', platform: 'wechat_session',
      });
      await Share.shareLink({
        platform: Platform.WECHAT_SESSION,
        title: 'T', url: 'https://x', description: 'D', thumb: 'https://t',
      });
      expect(NativeUmengShare.shareLink).toHaveBeenCalledWith(
        'wechat_session', 'T', 'https://x', 'D', 'https://t'
      );
    });

    it('rejects when title or url missing', async () => {
      await expect(
        Share.shareLink({ platform: Platform.WECHAT_SESSION, title: '', url: 'https://x' })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });

      await expect(
        Share.shareLink({ platform: Platform.WECHAT_SESSION, title: 'T', url: '' })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    });
  });

  describe('isInstalled', () => {
    it('returns boolean from native', async () => {
      (NativeUmengShare.isInstalled as jest.Mock).mockResolvedValue(true);
      await expect(Share.isInstalled(Platform.WECHAT_SESSION)).resolves.toBe(true);
    });
  });

  describe('listPlatforms', () => {
    it('returns SUPPORTED_PLATFORMS with installed/displayName', async () => {
      (NativeUmengShare.isInstalled as jest.Mock).mockImplementation((p: string) =>
        Promise.resolve(p === 'wechat_session')
      );
      const list = await Share.listPlatforms();
      expect(list).toEqual([
        { platform: Platform.WECHAT_SESSION, installed: true,  displayName: '微信' },
        { platform: Platform.DINGTALK,        installed: false, displayName: '钉钉' },
      ]);
    });
  });
});
```

- [ ] **Step 3: 跑测试，看失败**

```bash
yarn test src/__tests__/share.test.ts
```

Expected: FAIL — `Share.shareText` 等不存在。

- [ ] **Step 4: 写实现 src/share.ts**

```ts
import NativeUmengShare, { type NativeShareResult } from './NativeUmengShare';
import {
  Platform,
  PLATFORM_DISPLAY_NAMES,
  SUPPORTED_PLATFORMS,
  UmengError,
  type PlatformInfo,
  type ShareImageOptions,
  type ShareLinkOptions,
  type ShareResult,
  type ShareTextOptions,
} from './types';

function assertSupportedPlatform(p: Platform): void {
  if (!SUPPORTED_PLATFORMS.includes(p)) {
    throw new UmengError('E_PLATFORM_NOT_SUPPORTED', `Platform '${p}' is not supported`);
  }
}

function nativeToShareResult(n: NativeShareResult): ShareResult {
  return {
    code: n.code as ShareResult['code'],
    message: n.message,
    platform: n.platform as Platform,
  };
}

function settle(n: NativeShareResult): ShareResult {
  const r = nativeToShareResult(n);
  if (r.code === 'cancel') {
    throw new UmengError('E_USER_CANCEL', r.message ?? 'User cancelled', r);
  }
  if (r.code === 'failed') {
    throw new UmengError('E_SHARE_FAILED', r.message ?? 'Share failed', r);
  }
  return r;
}

export async function shareText(options: ShareTextOptions): Promise<ShareResult> {
  assertSupportedPlatform(options.platform);
  if (!options.text) {
    throw new UmengError('E_INVALID_OPTIONS', '`text` is required for shareText');
  }
  const n = await NativeUmengShare.shareText(options.platform, options.text);
  return settle(n);
}

export async function shareImage(options: ShareImageOptions): Promise<ShareResult> {
  assertSupportedPlatform(options.platform);
  if (!options.image) {
    throw new UmengError('E_INVALID_OPTIONS', '`image` is required for shareImage');
  }
  const n = await NativeUmengShare.shareImage(options.platform, options.image, options.thumb);
  return settle(n);
}

export async function shareLink(options: ShareLinkOptions): Promise<ShareResult> {
  assertSupportedPlatform(options.platform);
  if (!options.title) {
    throw new UmengError('E_INVALID_OPTIONS', '`title` is required for shareLink');
  }
  if (!options.url) {
    throw new UmengError('E_INVALID_OPTIONS', '`url` is required for shareLink');
  }
  const n = await NativeUmengShare.shareLink(
    options.platform,
    options.title,
    options.url,
    options.description,
    options.thumb
  );
  return settle(n);
}

export async function isInstalled(platform: Platform): Promise<boolean> {
  assertSupportedPlatform(platform);
  return NativeUmengShare.isInstalled(platform);
}

export async function listPlatforms(): Promise<PlatformInfo[]> {
  const installs = await Promise.all(
    SUPPORTED_PLATFORMS.map((p) => NativeUmengShare.isInstalled(p))
  );
  return SUPPORTED_PLATFORMS.map((p, i) => ({
    platform: p,
    installed: installs[i] ?? false,
    displayName: PLATFORM_DISPLAY_NAMES[p],
  }));
}
```

- [ ] **Step 5: 跑测试**

```bash
yarn test src/__tests__/share.test.ts
```

Expected: 全部 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/share.ts src/__tests__/share.test.ts src/__tests__/__mocks__/NativeUmengShare.ts
git commit -m "feat(js): Share low-level API (shareText/Image/Link/isInstalled/listPlatforms)"
```

---

### Task 8: 写 src/analytics.ts + 单测

**Files:**
- Create: `src/analytics.ts`
- Create: `src/__tests__/analytics.test.ts`
- Create: `src/__tests__/__mocks__/NativeUmengAnalytics.ts`

- [ ] **Step 1: 写 jest mock**

`src/__tests__/__mocks__/NativeUmengAnalytics.ts`：

```ts
const NativeUmengAnalytics = {
  onEvent: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
};

export default NativeUmengAnalytics;
```

- [ ] **Step 2: 写测试**

`src/__tests__/analytics.test.ts`：

```ts
jest.mock('../NativeUmengAnalytics');

import NativeUmengAnalytics from '../NativeUmengAnalytics';
import * as Analytics from '../analytics';

describe('Analytics', () => {
  beforeEach(() => {
    (NativeUmengAnalytics.onEvent as jest.Mock).mockClear();
    (NativeUmengAnalytics.signIn as jest.Mock).mockClear();
    (NativeUmengAnalytics.signOut as jest.Mock).mockClear();
  });

  it('onEvent forwards eventId and params', () => {
    Analytics.onEvent('login', { channel: 'wx' });
    expect(NativeUmengAnalytics.onEvent).toHaveBeenCalledWith('login', { channel: 'wx' });
  });

  it('onEvent with no params passes empty object', () => {
    Analytics.onEvent('open_app');
    expect(NativeUmengAnalytics.onEvent).toHaveBeenCalledWith('open_app', {});
  });

  it('onEvent stringifies number values', () => {
    Analytics.onEvent('purchase', { quantity: 3, price: 99.5 });
    expect(NativeUmengAnalytics.onEvent).toHaveBeenCalledWith('purchase', {
      quantity: '3',
      price: '99.5',
    });
  });

  it('signIn with userId only', () => {
    Analytics.signIn('user-42');
    expect(NativeUmengAnalytics.signIn).toHaveBeenCalledWith('user-42', undefined);
  });

  it('signIn with provider', () => {
    Analytics.signIn('user-42', 'WX');
    expect(NativeUmengAnalytics.signIn).toHaveBeenCalledWith('user-42', 'WX');
  });

  it('signOut delegates', () => {
    Analytics.signOut();
    expect(NativeUmengAnalytics.signOut).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: 跑测试，看失败**

```bash
yarn test src/__tests__/analytics.test.ts
```

- [ ] **Step 4: 写实现 src/analytics.ts**

```ts
import NativeUmengAnalytics from './NativeUmengAnalytics';

/** 自定义事件埋点 */
export function onEvent(
  eventId: string,
  params?: Record<string, string | number>
): void {
  const stringifiedParams: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      stringifiedParams[k] = typeof v === 'string' ? v : String(v);
    }
  }
  NativeUmengAnalytics.onEvent(eventId, stringifiedParams);
}

/** 用户登录账号埋点 */
export function signIn(userId: string, provider?: string): void {
  NativeUmengAnalytics.signIn(userId, provider);
}

/** 用户登出 */
export function signOut(): void {
  NativeUmengAnalytics.signOut();
}
```

- [ ] **Step 5: 跑测试**

```bash
yarn test src/__tests__/analytics.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/analytics.ts src/__tests__/analytics.test.ts src/__tests__/__mocks__/NativeUmengAnalytics.ts
git commit -m "feat(js): Analytics onEvent/signIn/signOut with number→string params"
```

---

### Task 9: 写 src/index.ts 统一出口

**Files:**
- Delete: `src/index.tsx`（task 1 留的占位）
- Create: `src/index.ts`

- [ ] **Step 1: 删 src/index.tsx 占位**

```bash
git rm src/index.tsx
```

- [ ] **Step 2: 写 src/index.ts**

```ts
export * as Common from './common';
export * as Share from './share';
export * as Analytics from './analytics';

export {
  Platform,
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DEFAULT_SUBTITLES,
  UmengError,
} from './types';

export type {
  ShareCode,
  ShareResult,
  ErrorCode,
  PlatformInfo,
  ShareTextOptions,
  ShareImageOptions,
  ShareLinkOptions,
  ShareSheetPayload,
  ShareSheetOptions,
} from './types';

// ShareSheetHost 会在 task 21 加入
```

- [ ] **Step 3: 跑 typecheck + 全量测试**

```bash
yarn typecheck && yarn test
```

Expected: 通过；jest 跑 4 个测试文件（types / common / share / analytics）。

- [ ] **Step 4: Commit**

```bash
git add src/index.ts src/index.tsx
git commit -m "feat(js): src/index.ts namespace exports (Common/Share/Analytics)"
```

---

## 阶段 3 · Android 实现

### Task 10: UmengBootstrap.kt — 共享 preInit + setPlatform + ensureInit 单例

**Files:**
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengBootstrap.kt`

- [ ] **Step 1: 写 UmengBootstrap.kt**

```kotlin
package com.unif.reactnativeumeng

import android.content.Context
import com.umeng.commonsdk.UMConfigure
import com.umeng.socialize.PlatformConfig

/**
 * Umeng 初始化共享单例。
 *
 * preInit / setPlatform 在任一 TurboModule 构造期就跑（无差别、不上报）。
 * init 由 JS Common.init() 触发，必须在用户同意《隐私协议》后才能进。
 *
 * 配置 key 从宿主 App 的 AndroidManifest meta-data 读：
 *   - UMENG_APPKEY
 *   - UMENG_CHANNEL（缺省 "default"）
 *   - UMENG_WECHAT_APPID
 *   - UMENG_WECHAT_APPSECRET
 *   - UMENG_DINGTALK_APPID
 */
object UmengBootstrap {
  @Volatile private var preInited = false
  @Volatile private var inited = false
  private val lock = Any()

  /** Module 构造期调用；多次调只执行一次。 */
  fun ensurePreInit(context: Context) {
    if (preInited) return
    synchronized(lock) {
      if (preInited) return
      val cfg = readConfig(context)
      UMConfigure.preInit(context.applicationContext, cfg.appkey, cfg.channel)
      preInited = true
    }
  }

  /** Common.init() 调用；多次调只执行一次。 */
  fun ensureInit(context: Context) {
    if (inited) return
    synchronized(lock) {
      if (inited) return
      ensurePreInit(context)
      val cfg = readConfig(context)
      UMConfigure.init(
        context.applicationContext,
        cfg.appkey,
        cfg.channel,
        UMConfigure.DEVICE_TYPE_PHONE,
        ""
      )
      cfg.wechatAppid?.let { id ->
        cfg.wechatSecret?.let { secret ->
          PlatformConfig.setWeixin(id, secret)
        }
      }
      cfg.dingtalkAppid?.let { id ->
        PlatformConfig.setDing(id)
      }
      cfg.fileProvider?.let { PlatformConfig.setFileProvider(it) }
      inited = true
    }
  }

  fun isInited(): Boolean = inited

  private data class Config(
    val appkey: String,
    val channel: String,
    val wechatAppid: String?,
    val wechatSecret: String?,
    val dingtalkAppid: String?,
    val fileProvider: String?,
  )

  private fun readConfig(context: Context): Config {
    val app = context.applicationContext
    val ai = app.packageManager.getApplicationInfo(
      app.packageName,
      android.content.pm.PackageManager.GET_META_DATA
    )
    val md = ai.metaData ?: throw IllegalStateException(
      "AndroidManifest meta-data missing; expected UMENG_APPKEY etc."
    )
    val appkey = md.getString("UMENG_APPKEY")
      ?: throw IllegalStateException("AndroidManifest meta-data UMENG_APPKEY is required")
    return Config(
      appkey = appkey,
      channel = md.getString("UMENG_CHANNEL") ?: "default",
      wechatAppid = md.getString("UMENG_WECHAT_APPID"),
      wechatSecret = md.getString("UMENG_WECHAT_APPSECRET"),
      dingtalkAppid = md.getString("UMENG_DINGTALK_APPID"),
      fileProvider = "${app.packageName}.fileprovider",
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/src/main/java/com/unif/reactnativeumeng/UmengBootstrap.kt
git commit -m "feat(android): UmengBootstrap singleton (preInit + init + setPlatform)"
```

---

### Task 11: UmengCommonModule.kt

**Files:**
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengCommonModule.kt`

- [ ] **Step 1: 写 UmengCommonModule.kt**

```kotlin
package com.unif.reactnativeumeng

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = UmengCommonModule.NAME)
class UmengCommonModule(reactContext: ReactApplicationContext) :
  NativeUmengCommonSpec(reactContext) {

  init {
    // 任一 module 构造期调一次 preInit
    UmengBootstrap.ensurePreInit(reactContext)
  }

  override fun getName(): String = NAME

  override fun init(promise: Promise) {
    try {
      UmengBootstrap.ensureInit(reactApplicationContext)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_UNKNOWN", t.message ?: "init failed", t)
    }
  }

  override fun isInited(promise: Promise) {
    promise.resolve(UmengBootstrap.isInited())
  }

  companion object {
    const val NAME = "UmengCommon"
  }
}
```

> 注：`NativeUmengCommonSpec` 是 codegen 生成的基类，第一次 build 时由 react-native-builder-bob/react-native gradle 插件生成在 `android/generated/`。如果 IDE 报红可以无视，build 时会生成。

- [ ] **Step 2: Commit**

```bash
git add android/src/main/java/com/unif/reactnativeumeng/UmengCommonModule.kt
git commit -m "feat(android): UmengCommonModule (init + isInited)"
```

---

### Task 12: UmengAnalyticsModule.kt

**Files:**
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengAnalyticsModule.kt`

- [ ] **Step 1: 写 UmengAnalyticsModule.kt**

```kotlin
package com.unif.reactnativeumeng

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.umeng.analytics.MobclickAgent

@ReactModule(name = UmengAnalyticsModule.NAME)
class UmengAnalyticsModule(reactContext: ReactApplicationContext) :
  NativeUmengAnalyticsSpec(reactContext) {

  init {
    UmengBootstrap.ensurePreInit(reactContext)
  }

  override fun getName(): String = NAME

  override fun onEvent(eventId: String, params: ReadableMap?) {
    // JS 端已 stringify 所有 value，这里 toHashMap 拿到 Map<String, Any>
    val map: MutableMap<String, Any> = params?.toHashMap()?.toMutableMap() ?: mutableMapOf()
    MobclickAgent.onEventObject(reactApplicationContext, eventId, map)
  }

  override fun signIn(userId: String, provider: String?) {
    if (provider.isNullOrEmpty()) {
      MobclickAgent.onProfileSignIn(userId)
    } else {
      MobclickAgent.onProfileSignIn(provider, userId)
    }
  }

  override fun signOut() {
    MobclickAgent.onProfileSignOff()
  }

  companion object {
    const val NAME = "UmengAnalytics"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/src/main/java/com/unif/reactnativeumeng/UmengAnalyticsModule.kt
git commit -m "feat(android): UmengAnalyticsModule (onEvent + profile sign-in/off)"
```

---

### Task 13: UmengShareModule.kt

**Files:**
- Create: `android/src/main/java/com/unif/reactnativeumeng/UmengShareModule.kt`

- [ ] **Step 1: 写 UmengShareModule.kt**

```kotlin
package com.unif.reactnativeumeng

import android.app.Activity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.umeng.socialize.ShareAction
import com.umeng.socialize.UMShareAPI
import com.umeng.socialize.UMShareListener
import com.umeng.socialize.bean.SHARE_MEDIA
import com.umeng.socialize.media.UMImage
import com.umeng.socialize.media.UMWeb

@ReactModule(name = UmengShareModule.NAME)
class UmengShareModule(reactContext: ReactApplicationContext) :
  NativeUmengShareSpec(reactContext) {

  init {
    UmengBootstrap.ensurePreInit(reactContext)
  }

  override fun getName(): String = NAME

  override fun shareText(platform: String, text: String, promise: Promise) {
    runOnUiThread {
      withActivity(promise) { activity ->
        val media = mapPlatform(platform, promise) ?: return@withActivity
        ShareAction(activity)
          .withText(text)
          .setPlatform(media)
          .setCallback(buildListener(platform, promise))
          .share()
      }
    }
  }

  override fun shareImage(platform: String, image: String, thumb: String?, promise: Promise) {
    runOnUiThread {
      withActivity(promise) { activity ->
        val media = mapPlatform(platform, promise) ?: return@withActivity
        val img = UMImage(activity, image)
        if (!thumb.isNullOrEmpty()) img.setThumb(UMImage(activity, thumb))
        ShareAction(activity)
          .withMedia(img)
          .setPlatform(media)
          .setCallback(buildListener(platform, promise))
          .share()
      }
    }
  }

  override fun shareLink(
    platform: String,
    title: String,
    url: String,
    description: String?,
    thumb: String?,
    promise: Promise
  ) {
    runOnUiThread {
      withActivity(promise) { activity ->
        val media = mapPlatform(platform, promise) ?: return@withActivity
        val web = UMWeb(url)
        web.title = title
        if (!description.isNullOrEmpty()) web.description = description
        if (!thumb.isNullOrEmpty()) web.setThumb(UMImage(activity, thumb))
        ShareAction(activity)
          .withMedia(web)
          .setPlatform(media)
          .setCallback(buildListener(platform, promise))
          .share()
      }
    }
  }

  override fun isInstalled(platform: String, promise: Promise) {
    val media = mapPlatform(platform, promise) ?: return
    val activity = currentActivity
    if (activity == null) {
      // 无 Activity 时退化用 applicationContext 提示性查询；友盟实际查需要 activity
      promise.resolve(false)
      return
    }
    promise.resolve(UMShareAPI.get(activity).isInstall(activity, media))
  }

  // ── helpers ──────────────────────────────────────────────

  private fun mapPlatform(p: String, promise: Promise): SHARE_MEDIA? {
    return when (p) {
      "wechat_session" -> SHARE_MEDIA.WEIXIN
      "dingtalk" -> SHARE_MEDIA.DINGTALK
      else -> {
        promise.reject("E_PLATFORM_NOT_SUPPORTED", "Platform '$p' is not supported")
        null
      }
    }
  }

  private fun withActivity(promise: Promise, block: (Activity) -> Unit) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("E_UNKNOWN", "No current Activity; cannot invoke share")
      return
    }
    block(activity)
  }

  private fun runOnUiThread(block: () -> Unit) {
    if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) block()
    else android.os.Handler(android.os.Looper.getMainLooper()).post(block)
  }

  private fun buildListener(platform: String, promise: Promise): UMShareListener {
    return object : UMShareListener {
      override fun onStart(p0: SHARE_MEDIA?) {}
      override fun onResult(p0: SHARE_MEDIA?) {
        val map = Arguments.createMap()
        map.putString("code", "success")
        map.putString("platform", platform)
        promise.resolve(map)
      }
      override fun onError(p0: SHARE_MEDIA?, t: Throwable?) {
        val map = Arguments.createMap()
        map.putString("code", "failed")
        map.putString("message", t?.message ?: "unknown error")
        map.putString("platform", platform)
        promise.resolve(map)
      }
      override fun onCancel(p0: SHARE_MEDIA?) {
        val map = Arguments.createMap()
        map.putString("code", "cancel")
        map.putString("platform", platform)
        promise.resolve(map)
      }
    }
  }

  companion object {
    const val NAME = "UmengShare"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/src/main/java/com/unif/reactnativeumeng/UmengShareModule.kt
git commit -m "feat(android): UmengShareModule (text/image/link/isInstalled, async listener)"
```

---

### Task 14: ReactNativeUmengPackage.kt — 注册三个 TurboModule

**Files:**
- Create: `android/src/main/java/com/unif/reactnativeumeng/ReactNativeUmengPackage.kt`

- [ ] **Step 1: 写 Package**

```kotlin
package com.unif.reactnativeumeng

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ReactNativeUmengPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      UmengCommonModule.NAME -> UmengCommonModule(reactContext)
      UmengShareModule.NAME -> UmengShareModule(reactContext)
      UmengAnalyticsModule.NAME -> UmengAnalyticsModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        UmengCommonModule.NAME to ReactModuleInfo(
          UmengCommonModule.NAME, UmengCommonModule::class.java.name,
          false, false, false, true
        ),
        UmengShareModule.NAME to ReactModuleInfo(
          UmengShareModule.NAME, UmengShareModule::class.java.name,
          false, false, false, true
        ),
        UmengAnalyticsModule.NAME to ReactModuleInfo(
          UmengAnalyticsModule.NAME, UmengAnalyticsModule::class.java.name,
          false, false, false, true
        ),
      )
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/src/main/java/com/unif/reactnativeumeng/ReactNativeUmengPackage.kt
git commit -m "feat(android): ReactNativeUmengPackage registers three TurboModules"
```

---

## 阶段 4 · iOS 实现（Swift Adapter Pattern）

### Task 15: UmengBootstrap.swift — 共享单例

**Files:**
- Create: `ios/UmengBootstrap.swift`

- [ ] **Step 1: 写 UmengBootstrap.swift**

```swift
import Foundation
import UIKit
import UMCommon
import UMShare

/// Umeng iOS 初始化共享单例。
///
/// iOS 公开 SDK 没有 preInit。PIPL 解法：用户同意《隐私协议》前完全不调任何友盟 API。
/// `ensureInit()` 由 `UmengCommonImpl.init()` 触发，读 Info.plist 配置，跑
/// UMConfigure.initWithAppkey + setPlaform（拼写遵循 SDK 原始错误，少一个 t）。
@objcMembers
public final class UmengBootstrap: NSObject {
  public static let shared = UmengBootstrap()
  private let lock = NSLock()
  private var inited = false

  private override init() { super.init() }

  public func ensureInit() throws {
    lock.lock()
    defer { lock.unlock() }
    if inited { return }
    let cfg = try readConfig()
    UMConfigure.initWithAppkey(cfg.appkey, channel: cfg.channel)
    if let wxId = cfg.wechatAppid, let wxSecret = cfg.wechatSecret {
      UMSocialManager.default()?.setPlaform(
        .wechatSession,
        appKey: wxId,
        appSecret: wxSecret,
        redirectURL: nil
      )
      if let ul = cfg.wechatUniversalLink {
        UMSocialGlobal.shareInstance().universalLinkDic = [
          NSNumber(value: UMSocialPlatformType.wechatSession.rawValue): ul
        ]
      }
    }
    if let ddId = cfg.dingtalkAppid {
      UMSocialManager.default()?.setPlaform(
        .dingDing,
        appKey: ddId,
        appSecret: nil,
        redirectURL: nil
      )
    }
    inited = true
  }

  public func isInited() -> Bool {
    lock.lock(); defer { lock.unlock() }
    return inited
  }

  /// 由宿主 App 的 application(_:open:options:) 调
  public func handleOpen(_ url: URL, options: [UIApplication.OpenURLOptionsKey: Any]) -> Bool {
    return UMSocialManager.default()?.handleOpen(url, options: options) ?? false
  }

  /// 由宿主 App 的 continueUserActivity:restorationHandler: 调（微信 UL 必需）
  public func handleUniversalLink(_ userActivity: NSUserActivity) -> Bool {
    return UMSocialManager.default()?.handleUniversalLink(userActivity, options: nil) ?? false
  }

  // ── private ──────────────────────────────────────────────

  private struct Config {
    let appkey: String
    let channel: String
    let wechatAppid: String?
    let wechatSecret: String?
    let wechatUniversalLink: String?
    let dingtalkAppid: String?
  }

  private func readConfig() throws -> Config {
    guard let info = Bundle.main.infoDictionary else {
      throw NSError(domain: "UmengBootstrap", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Info.plist not available"
      ])
    }
    guard let appkey = info["UMENG_APPKEY"] as? String, !appkey.isEmpty else {
      throw NSError(domain: "UmengBootstrap", code: -2, userInfo: [
        NSLocalizedDescriptionKey: "Info.plist key UMENG_APPKEY is required"
      ])
    }
    return Config(
      appkey: appkey,
      channel: (info["UMENG_CHANNEL"] as? String) ?? "App Store",
      wechatAppid: info["UMENG_WECHAT_APPID"] as? String,
      wechatSecret: info["UMENG_WECHAT_APPSECRET"] as? String,
      wechatUniversalLink: info["UMENG_WECHAT_UNIVERSAL_LINK"] as? String,
      dingtalkAppid: info["UMENG_DINGTALK_APPID"] as? String
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/UmengBootstrap.swift
git commit -m "feat(ios): UmengBootstrap (read Info.plist + initWithAppkey + setPlaform)"
```

---

### Task 16: UmengCommon — 三件套

**Files:**
- Create: `ios/UmengCommon.h`
- Create: `ios/UmengCommon.mm`
- Create: `ios/UmengCommonImpl.swift`

- [ ] **Step 1: 写 UmengCommon.h**

```objc
#import <Foundation/Foundation.h>
#import <ReactNativeUmengSpec/ReactNativeUmengSpec.h>

NS_ASSUME_NONNULL_BEGIN

@interface UmengCommon : NSObject <NativeUmengCommonSpec>
@end

NS_ASSUME_NONNULL_END
```

> codegen 输出路径：`ios/build/generated/ios/ReactNativeUmengSpec/ReactNativeUmengSpec.h`，由 `pod install` 时 RN 脚本自动跑（基于 `codegenConfig.name = ReactNativeUmengSpec`）。第一次 build 前 IDE 可能报红，pod install 之后正常。

- [ ] **Step 2: 写 UmengCommon.mm**

```objcpp
#import "UmengCommon.h"
#import "react_native_umeng-Swift.h"

@implementation UmengCommon

RCT_EXPORT_MODULE(UmengCommon)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengCommonSpecJSI>(params);
}

- (void)init:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject {
  [[UmengCommonImpl new] initResolve:resolve reject:reject];
}

- (void)isInited:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  [[UmengCommonImpl new] isInitedResolve:resolve reject:reject];
}

@end
```

- [ ] **Step 3: 写 UmengCommonImpl.swift**

```swift
import Foundation
import React

@objcMembers
public class UmengCommonImpl: NSObject {

  public func initResolve(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
    do {
      try UmengBootstrap.shared.ensureInit()
      resolve(NSNull())
    } catch let nsError as NSError {
      reject("E_UNKNOWN", nsError.localizedDescription, nsError)
    } catch {
      reject("E_UNKNOWN", "init failed: \(error)", nil)
    }
  }

  public func isInitedResolve(_ resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
    resolve(UmengBootstrap.shared.isInited())
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add ios/UmengCommon.h ios/UmengCommon.mm ios/UmengCommonImpl.swift
git commit -m "feat(ios): UmengCommon triplet (init + isInited)"
```

---

### Task 17: UmengAnalytics — 三件套

**Files:**
- Create: `ios/UmengAnalytics.h`
- Create: `ios/UmengAnalytics.mm`
- Create: `ios/UmengAnalyticsImpl.swift`

- [ ] **Step 1: 写 UmengAnalytics.h**

```objc
#import <Foundation/Foundation.h>
#import <ReactNativeUmengSpec/ReactNativeUmengSpec.h>

NS_ASSUME_NONNULL_BEGIN

@interface UmengAnalytics : NSObject <NativeUmengAnalyticsSpec>
@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 写 UmengAnalytics.mm**

```objcpp
#import "UmengAnalytics.h"
#import "react_native_umeng-Swift.h"

@implementation UmengAnalytics

RCT_EXPORT_MODULE(UmengAnalytics)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengAnalyticsSpecJSI>(params);
}

- (void)onEvent:(NSString *)eventId params:(NSDictionary *)params {
  [[UmengAnalyticsImpl new] onEventWithEventId:eventId params:params];
}

- (void)signIn:(NSString *)userId provider:(NSString *)provider {
  [[UmengAnalyticsImpl new] signInWithUserId:userId provider:provider];
}

- (void)signOut {
  [[UmengAnalyticsImpl new] signOut];
}

@end
```

- [ ] **Step 3: 写 UmengAnalyticsImpl.swift**

```swift
import Foundation
import UMCommon

@objcMembers
public class UmengAnalyticsImpl: NSObject {

  public func onEvent(eventId: String, params: NSDictionary?) {
    if let p = params as? [String: Any], !p.isEmpty {
      // MobClick.event attributes 要求 value 是 NSString — JS 端已 stringify
      var stringDict: [String: NSString] = [:]
      for (k, v) in p {
        stringDict[k] = (v as? String).map { $0 as NSString } ?? NSString(string: "\(v)")
      }
      MobClick.event(eventId, attributes: stringDict)
    } else {
      MobClick.event(eventId)
    }
  }

  public func signIn(userId: String, provider: String?) {
    if let pr = provider, !pr.isEmpty {
      MobClick.profileSignIn(withPUID: userId, provider: pr)
    } else {
      MobClick.profileSignIn(withPUID: userId)
    }
  }

  public func signOut() {
    MobClick.profileSignOff()
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add ios/UmengAnalytics.h ios/UmengAnalytics.mm ios/UmengAnalyticsImpl.swift
git commit -m "feat(ios): UmengAnalytics triplet (onEvent + profile sign-in/off)"
```

---

### Task 18: UmengShare — 三件套

**Files:**
- Create: `ios/UmengShare.h`
- Create: `ios/UmengShare.mm`
- Create: `ios/UmengShareImpl.swift`

- [ ] **Step 1: 写 UmengShare.h**

```objc
#import <Foundation/Foundation.h>
#import <ReactNativeUmengSpec/ReactNativeUmengSpec.h>

NS_ASSUME_NONNULL_BEGIN

@interface UmengShare : NSObject <NativeUmengShareSpec>
@end

NS_ASSUME_NONNULL_END
```

- [ ] **Step 2: 写 UmengShare.mm**

```objcpp
#import "UmengShare.h"
#import "react_native_umeng-Swift.h"

@implementation UmengShare

RCT_EXPORT_MODULE(UmengShare)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeUmengShareSpecJSI>(params);
}

- (void)shareText:(NSString *)platform text:(NSString *)text
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] shareTextWithPlatform:platform text:text resolve:resolve reject:reject];
}

- (void)shareImage:(NSString *)platform image:(NSString *)image thumb:(NSString *)thumb
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] shareImageWithPlatform:platform image:image thumb:thumb resolve:resolve reject:reject];
}

- (void)shareLink:(NSString *)platform
            title:(NSString *)title
              url:(NSString *)url
      description:(NSString *)description
            thumb:(NSString *)thumb
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] shareLinkWithPlatform:platform title:title url:url description:description thumb:thumb resolve:resolve reject:reject];
}

- (void)isInstalled:(NSString *)platform
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject {
  [[UmengShareImpl new] isInstalledWithPlatform:platform resolve:resolve reject:reject];
}

@end
```

- [ ] **Step 3: 写 UmengShareImpl.swift**

```swift
import Foundation
import UIKit
import UMCommon
import UMShare
import React

@objcMembers
public class UmengShareImpl: NSObject {

  // MARK: - Public bridge

  public func shareText(platform: String, text: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard let umPlatform = mapPlatform(platform, reject: reject) else { return }
    DispatchQueue.main.async {
      let msg = UMSocialMessageObject()
      msg.text = text
      self.runShare(platform: platform, umPlatform: umPlatform, message: msg,
                    resolve: resolve, reject: reject)
    }
  }

  public func shareImage(platform: String, image: String, thumb: String?,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    guard let umPlatform = mapPlatform(platform, reject: reject) else { return }
    DispatchQueue.main.async {
      let img = UMShareImageObject()
      img.shareImage = image as NSString
      if let t = thumb, !t.isEmpty { img.thumbImage = t as NSString }
      let msg = UMSocialMessageObject()
      msg.shareObject = img
      self.runShare(platform: platform, umPlatform: umPlatform, message: msg,
                    resolve: resolve, reject: reject)
    }
  }

  public func shareLink(platform: String,
                        title: String,
                        url: String,
                        description: String?,
                        thumb: String?,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard let umPlatform = mapPlatform(platform, reject: reject) else { return }
    DispatchQueue.main.async {
      let web = UMShareWebpageObject.shareObject(
        withTitle: title,
        descr: description ?? "",
        thumImage: thumb as Any?
      )
      web.webpageUrl = url
      let msg = UMSocialMessageObject()
      msg.shareObject = web
      self.runShare(platform: platform, umPlatform: umPlatform, message: msg,
                    resolve: resolve, reject: reject)
    }
  }

  public func isInstalled(platform: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
    let scheme: String
    switch platform {
    case "wechat_session": scheme = "weixin://"
    case "dingtalk":        scheme = "dingtalk://"
    default:
      reject("E_PLATFORM_NOT_SUPPORTED", "Platform '\(platform)' is not supported", nil)
      return
    }
    DispatchQueue.main.async {
      let url = URL(string: scheme)!
      resolve(UIApplication.shared.canOpenURL(url))
    }
  }

  // MARK: - Helpers

  private func mapPlatform(_ p: String, reject: RCTPromiseRejectBlock) -> UMSocialPlatformType? {
    switch p {
    case "wechat_session": return .wechatSession
    case "dingtalk":        return .dingDing
    default:
      reject("E_PLATFORM_NOT_SUPPORTED", "Platform '\(p)' is not supported", nil)
      return nil
    }
  }

  private func runShare(platform: String,
                        umPlatform: UMSocialPlatformType,
                        message: UMSocialMessageObject,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    UMSocialManager.default()?.share(
      to: umPlatform,
      messageObject: message,
      currentViewController: nil,
      completion: { _, error in
        if let err = error as NSError? {
          // 友盟 cancel = 2009
          if err.code == 2009 {
            resolve(["code": "cancel", "platform": platform])
          } else if err.code == 2008 {
            resolve(["code": "failed", "message": "platform not installed", "platform": platform])
          } else {
            resolve(["code": "failed",
                     "message": err.localizedDescription,
                     "platform": platform])
          }
          return
        }
        resolve(["code": "success", "platform": platform])
      }
    )
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add ios/UmengShare.h ios/UmengShare.mm ios/UmengShareImpl.swift
git commit -m "feat(ios): UmengShare triplet (text/image/link/isInstalled)"
```

---

## 阶段 5 · RN ShareSheet UI（基于 @unif/react-native-design）

### Task 19: WeChatGlyph + DingTalkGlyph + PlatformLeading

**Files:**
- Create: `src/ShareSheet/WeChatGlyph.tsx`
- Create: `src/ShareSheet/DingTalkGlyph.tsx`
- Create: `src/ShareSheet/PlatformLeading.tsx`

- [ ] **Step 1: 写 WeChatGlyph.tsx**

> SVG path 直接搬自 `docs/superpowers/design-refs/share-panel/brand-icons/wechat.svg`（SimpleIcons CC0）。

```tsx
import React from 'react';
import { Svg, Path } from 'react-native-svg';

export interface WeChatGlyphProps {
  size?: number;
  color?: string;
}

export const WeChatGlyph = ({ size = 18, color = '#FFFFFF' }: WeChatGlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088v-.029c-.135-.01-.27-.027-.407-.027zm-2.53 3.46c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
  </Svg>
);
```

- [ ] **Step 2: 写 DingTalkGlyph.tsx**

> path 直接搬自 `docs/superpowers/design-refs/share-panel/brand-icons/dingtalk.svg`（用户提供的官方多色蓝渐变 logo）。

```tsx
import React from 'react';
import { Svg, Path } from 'react-native-svg';

export interface DingTalkGlyphProps {
  size?: number;
}

export const DingTalkGlyph = ({ size = 22 }: DingTalkGlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 1024 1024">
    <Path
      d="M709.2224 678.656h114.176c-71.0144 99.2768-139.3152 194.7136-207.616 290.1504-1.6384-0.5632-3.2768-1.1776-4.9152-1.7408 14.8992-62.6688 29.7984-125.3888 45.312-190.72h-89.2416c10.1376-46.2848 19.6608-89.7536 30.0544-137.2672-25.3952 7.6288-47.5136 12.0832-67.7376 20.8896-43.7248 19.0464-83.0976 10.9056-118.5792-17.2544-23.5008-18.6368-46.4384-38.9632-65.5872-61.9008-19.968-23.9616-13.7216-37.632 16.6912-42.752 64.3072-10.8544 128.8192-20.3776 193.4336-32.3584-13.5168 0-27.0336 0.1024-40.5504 0-55.6032-0.5632-111.2064-1.4336-166.8608-1.6384-34.1504-0.1024-58.1632-17.8176-78.7968-42.5472-26.624-31.9488-44.1856-68.4032-54.1184-108.544-6.2976-25.4464 0.6656-32.4608 26.9312-26.368 66.4576 15.4624 132.7104 31.4368 199.168 47.0016 33.9456 7.936 67.9936 15.3088 102.9632 19.712-40.2944-13.312-80.9984-25.4976-120.7808-40.2432-60.6208-22.4768-120.5248-46.9504-180.9408-70.0416-18.3296-7.0144-30.464-19.2-38.144-36.8128-23.6032-53.8624-41.216-109.2096-41.6768-168.6528-0.1536-21.6576 7.0656-26.9824 25.7024-17.9712C377.7536 151.2448 573.44 228.4544 769.8944 303.872c18.8416 7.2192 36.7616 17.8688 53.7088 29.0816 32.6144 21.7088 43.264 49.1008 26.368 83.456-34.7136 70.5536-72.8576 139.4688-109.8752 208.896-9.1648 17.152-19.456 33.6896-30.8736 53.3504z"
      fill="#2595E8"
    />
    <Path
      d="M763.5968 301.4144C569.2416 226.816 375.7568 150.2208 188.16 59.5456c-18.5856-9.0112-25.856-3.6864-25.7024 17.9712 0.4608 59.4432 18.0736 114.7904 41.6768 168.6528 7.7312 17.6128 19.8144 29.7984 38.144 36.8128 60.416 23.0912 120.32 47.5648 180.9408 70.0416 39.7824 14.7456 80.4864 26.9312 120.7808 40.2432-34.9696-4.4032-69.0176-11.776-102.9632-19.712-66.4064-15.5136-132.7104-31.5392-199.168-47.0016-26.2656-6.0928-33.2288 0.9216-26.9312 26.368 9.9328 40.192 27.4944 76.5952 54.1184 108.544 20.5824 24.7296 44.6464 42.3936 78.7968 42.5472 55.6032 0.2048 111.2064 1.1264 166.8608 1.6384 13.5168 0.1536 27.0336 0 40.5504 0-64.6144 11.9808-129.1264 21.5552-193.4336 32.3584-30.4128 5.12-36.608 18.7904-16.6912 42.752 19.0976 22.9376 42.0864 43.264 65.5872 61.9008 35.4816 28.16 74.8032 36.3008 118.5792 17.2544 20.224-8.8064 42.3936-13.2096 67.7376-20.8896-5.1712 23.6032-10.1376 46.2336-15.0528 68.7104 109.3632-101.632 178.6368-245.8112 181.6064-406.3232z"
      fill="#3A9CED"
    />
    <Path
      d="M242.2784 282.9312c60.416 23.0912 120.32 47.5648 180.9408 70.0416 33.1264 12.288 66.9184 22.8352 100.5568 33.6896 28.928-47.0016 51.2512-98.4576 65.5872-153.1904-135.4752-53.8624-269.824-110.3872-401.2544-173.9776-18.5856-9.0112-25.856-3.6864-25.7024 17.9712 0.4608 59.4432 18.0736 114.7904 41.6768 168.6528 7.7824 17.6128 19.9168 29.8496 38.1952 36.8128zM441.0368 373.504c-66.4064-15.5136-132.7104-31.5392-199.168-47.0016-26.2656-6.0928-33.2288 0.9216-26.9312 26.368 9.9328 40.192 27.4944 76.5952 54.1184 108.544 20.5824 24.7296 44.6464 42.3936 78.7968 42.5472 26.4192 0.1024 52.8896 0.3584 79.3088 0.6656 36.2496-33.8944 68.096-72.3968 94.5152-114.688-27.1872-4.352-53.9648-10.1888-80.64-16.4352zM361.7792 538.0608c-26.624 4.5056-34.6624 15.5136-22.8864 34.304 19.5072-12.1344 38.1952-25.4464 56.064-39.7824-11.0592 1.792-22.1184 3.584-33.1776 5.4784z"
      fill="#59ADF8"
    />
    <Path
      d="M242.2784 282.9312c14.8992 5.6832 29.7984 11.4688 44.6464 17.3056 44.3904-42.0352 82.0224-91.0848 111.0528-145.5104-70.6048-30.2592-140.6464-61.7472-209.8688-95.232-18.5856-9.0112-25.856-3.6864-25.7024 17.9712 0.4608 59.4432 18.0736 114.7904 41.6768 168.6528 7.7824 17.6128 19.9168 29.8496 38.1952 36.8128zM241.8688 326.5536c-26.2656-6.0928-33.2288 0.9216-26.9312 26.368 0.3584 1.536 0.8704 3.0208 1.28 4.5568 12.9536-8.8576 25.4976-18.2272 37.6832-28.1088-4.0448-0.9216-8.0384-1.8944-12.032-2.816z"
      fill="#6BC2FC"
    />
  </Svg>
);
```

- [ ] **Step 3: 写 PlatformLeading.tsx**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@unif/react-native-design';
import { Platform } from '../types';
import { WeChatGlyph } from './WeChatGlyph';
import { DingTalkGlyph } from './DingTalkGlyph';

export interface PlatformLeadingProps {
  platform: Platform;
  size?: number;
}

/**
 * 32×32 圆角 8 容器：
 *   微信 → 实色 #07C160 + 白色 SimpleIcons glyph
 *   钉钉 → surface-container 浅色 + 多色官方 logo
 */
export const PlatformLeading = ({ platform, size = 32 }: PlatformLeadingProps) => {
  const theme = useTheme();

  if (platform === Platform.WECHAT_SESSION) {
    return (
      <View style={[styles.container, { width: size, height: size, backgroundColor: '#07C160' }]}>
        <WeChatGlyph size={Math.round(size * 0.5625)} />
      </View>
    );
  }
  if (platform === Platform.DINGTALK) {
    return (
      <View style={[
        styles.container,
        { width: size, height: size, backgroundColor: theme.c.surfaceContainer },
      ]}>
        <DingTalkGlyph size={Math.round(size * 0.6875)} />
      </View>
    );
  }
  return null;
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

> `theme.c.surfaceContainer` 是 design 系统 token；如实际属性名不同（design 0.1.2 用 `colors.surfaceContainer` 或 `c.surfaceContainer`），实施时按 design 实际 API 调整。

- [ ] **Step 4: Commit**

```bash
git add src/ShareSheet/WeChatGlyph.tsx src/ShareSheet/DingTalkGlyph.tsx src/ShareSheet/PlatformLeading.tsx
git commit -m "feat(rn-ui): brand glyphs (SimpleIcons WeChat + official DingTalk) + leading tile"
```

---

### Task 20: ShareSheetController（单例 + EventEmitter）

**Files:**
- Create: `src/ShareSheet/ShareSheetController.ts`
- Create: `src/__tests__/ShareSheetController.test.ts`

- [ ] **Step 1: 写测试**

`src/__tests__/ShareSheetController.test.ts`：

```ts
import { ShareSheetController } from '../ShareSheet/ShareSheetController';
import type { ShareSheetPayload, ShareSheetOptions } from '../types';

describe('ShareSheetController', () => {
  let controller: ShareSheetController;
  beforeEach(() => {
    controller = new ShareSheetController();
  });

  it('show() returns a pending Promise', () => {
    const payload: ShareSheetPayload = { type: 'text', text: 'hi' };
    const p = controller.show(payload);
    expect(p).toBeInstanceOf(Promise);
    controller.dismiss('cancel');
    return expect(p).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
  });

  it('subscribers receive show event with payload + options', () => {
    const listener = jest.fn();
    controller.subscribe(listener);
    const payload: ShareSheetPayload = { type: 'link', title: 'T', url: 'u' };
    const opts: ShareSheetOptions = { title: '分享至 X' };
    void controller.show(payload, opts);
    expect(listener).toHaveBeenCalledWith({
      kind: 'show', payload, options: opts,
    });
  });

  it('settle(result) resolves the in-flight Promise', async () => {
    const p = controller.show({ type: 'text', text: 'hi' });
    controller.settle({ code: 'success', platform: 'wechat_session' as any });
    await expect(p).resolves.toEqual({ code: 'success', platform: 'wechat_session' });
  });

  it('rejects when controller has no host subscriber', () => {
    const fresh = new ShareSheetController();
    return expect(fresh.show({ type: 'text', text: 'hi' }))
      .rejects.toMatchObject({ code: 'E_UNKNOWN' });
  });

  it('subscriber removal stops receiving events', () => {
    const listener = jest.fn();
    const unsub = controller.subscribe(listener);
    unsub();
    void controller.show({ type: 'text', text: 'hi' }).catch(() => {});
    expect(listener).not.toHaveBeenCalled();
  });

  it('only one show at a time — second show rejects immediately', async () => {
    const p1 = controller.show({ type: 'text', text: '1' });
    const p2 = controller.show({ type: 'text', text: '2' });
    await expect(p2).rejects.toMatchObject({ code: 'E_UNKNOWN' });
    controller.dismiss('cancel');
    await expect(p1).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
  });
});
```

- [ ] **Step 2: 跑测试，看失败**

```bash
yarn test src/__tests__/ShareSheetController.test.ts
```

- [ ] **Step 3: 写实现**

`src/ShareSheet/ShareSheetController.ts`：

```ts
import {
  UmengError,
  type ShareResult,
  type ShareSheetOptions,
  type ShareSheetPayload,
} from '../types';

export type ControllerEvent =
  | { kind: 'show'; payload: ShareSheetPayload; options: ShareSheetOptions }
  | { kind: 'dismiss' };

type Listener = (e: ControllerEvent) => void;

interface PendingShow {
  resolve: (r: ShareResult) => void;
  reject: (e: UmengError) => void;
}

export class ShareSheetController {
  private listeners: Set<Listener> = new Set();
  private pending: PendingShow | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  show(payload: ShareSheetPayload, options: ShareSheetOptions = {}): Promise<ShareResult> {
    return new Promise<ShareResult>((resolve, reject) => {
      if (this.listeners.size === 0) {
        reject(new UmengError(
          'E_UNKNOWN',
          'No <ShareSheetHost /> mounted. Mount it once at app root.'
        ));
        return;
      }
      if (this.pending !== null) {
        reject(new UmengError(
          'E_UNKNOWN',
          'Another ShareSheet is already open. Dismiss the previous one first.'
        ));
        return;
      }
      this.pending = { resolve, reject };
      this.emit({ kind: 'show', payload, options });
    });
  }

  /** Host 在分享 success 时调；resolve openSheet Promise */
  settle(result: ShareResult): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.resolve(result);
    this.emit({ kind: 'dismiss' });
  }

  /** Host 在 cancel / failed 时调；reject openSheet Promise */
  settleError(err: UmengError): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.reject(err);
    this.emit({ kind: 'dismiss' });
  }

  /** 用户主动取消 / 取消按钮 / scrim 点击 */
  dismiss(reason: 'cancel' = 'cancel'): void {
    if (!this.pending) return;
    this.settleError(new UmengError('E_USER_CANCEL', 'User cancelled', { reason }));
  }

  private emit(e: ControllerEvent): void {
    for (const l of this.listeners) l(e);
  }
}

/** 模块级单例，供 Share.openSheet 与 ShareSheetHost 共用 */
export const shareSheetController = new ShareSheetController();
```

- [ ] **Step 4: 跑测试**

```bash
yarn test src/__tests__/ShareSheetController.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ShareSheet/ShareSheetController.ts src/__tests__/ShareSheetController.test.ts
git commit -m "feat(rn-ui): ShareSheetController singleton with show/settle/dismiss"
```

---

### Task 21: ShareSheetHost.tsx（基于 design BottomSheet/Cell/Button）

**Files:**
- Create: `src/ShareSheet/ShareSheetHost.tsx`
- Create: `src/__tests__/ShareSheetHost.test.tsx`

- [ ] **Step 1: 写测试**

`src/__tests__/ShareSheetHost.test.tsx`：

```tsx
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { ShareSheetHost } from '../ShareSheet/ShareSheetHost';
import { shareSheetController } from '../ShareSheet/ShareSheetController';
import { Platform } from '../types';

jest.mock('@unif/react-native-design', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => ({ c: { surfaceContainer: '#f0f0f0', foreground: '#111' } }),
    BottomSheet: ({ children, onClose }: any) =>
      React.createElement(View, { testID: 'bottom-sheet', onLayout: () => onClose?.() }, children),
    Cell: ({ title, desc, onPress, disabled, testID }: any) =>
      React.createElement(
        TouchableOpacity,
        { testID, onPress, disabled, accessibilityState: { disabled } },
        React.createElement(Text, null, title),
        desc && React.createElement(Text, null, desc)
      ),
    Button: ({ label, onPress, testID }: any) =>
      React.createElement(
        TouchableOpacity,
        { testID, onPress },
        React.createElement(Text, null, label)
      ),
  };
});
jest.mock('../share', () => ({
  shareText: jest.fn(),
  shareImage: jest.fn(),
  shareLink: jest.fn(),
  isInstalled: jest.fn().mockResolvedValue(true),
}));

describe('ShareSheetHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a Cell for each supported platform when shown', async () => {
    const { queryByTestId } = render(<ShareSheetHost />);
    await act(async () => {
      void shareSheetController.show({ type: 'text', text: 'hi' }).catch(() => {});
    });
    expect(queryByTestId('umeng-share-cell-wechat_session')).not.toBeNull();
    expect(queryByTestId('umeng-share-cell-dingtalk')).not.toBeNull();
  });

  it('dismisses on cancel button press', async () => {
    const { getByTestId } = render(<ShareSheetHost />);
    const p = shareSheetController.show({ type: 'text', text: 'hi' });
    await act(async () => {}); // flush
    await act(async () => {
      getByTestId('umeng-share-cancel').props.onPress();
    });
    await expect(p).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
  });
});
```

- [ ] **Step 2: 跑测试，看失败**

```bash
yarn test src/__tests__/ShareSheetHost.test.tsx
```

Expected: FAIL — `ShareSheetHost` 未实现。

- [ ] **Step 3: 写实现**

`src/ShareSheet/ShareSheetHost.tsx`：

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  BottomSheet,
  Cell,
  Button,
  useTheme,
} from '@unif/react-native-design';
import {
  PLATFORM_DEFAULT_SUBTITLES,
  PLATFORM_DISPLAY_NAMES,
  Platform,
  SUPPORTED_PLATFORMS,
  UmengError,
  type ShareSheetOptions,
  type ShareSheetPayload,
  type ShareResult,
  type PlatformInfo,
} from '../types';
import * as Share from '../share';
import { shareSheetController } from './ShareSheetController';
import { PlatformLeading } from './PlatformLeading';

interface SheetState {
  open: boolean;
  payload: ShareSheetPayload | null;
  options: ShareSheetOptions;
  platforms: PlatformInfo[];
}

const INITIAL_STATE: SheetState = {
  open: false,
  payload: null,
  options: {},
  platforms: [],
};

export const ShareSheetHost: React.FC = () => {
  const theme = useTheme();
  const [state, setState] = useState<SheetState>(INITIAL_STATE);

  useEffect(() => {
    const unsub = shareSheetController.subscribe((e) => {
      if (e.kind === 'show') {
        void (async () => {
          const platforms = await Share.listPlatforms().catch(() => (
            SUPPORTED_PLATFORMS.map((p) => ({
              platform: p,
              installed: false,
              displayName: PLATFORM_DISPLAY_NAMES[p],
            }))
          ));
          setState({ open: true, payload: e.payload, options: e.options, platforms });
        })();
      } else if (e.kind === 'dismiss') {
        setState((prev) => ({ ...prev, open: false }));
      }
    });
    return unsub;
  }, []);

  const handlePlatformPress = useCallback((info: PlatformInfo) => {
    if (!info.installed) {
      shareSheetController.settleError(
        new UmengError('E_PLATFORM_NOT_INSTALLED', `${info.displayName} 未安装`)
      );
      return;
    }
    const { payload } = state;
    if (!payload) return;
    void (async () => {
      try {
        let result: ShareResult;
        if (payload.type === 'text') {
          result = await Share.shareText({ platform: info.platform, text: payload.text });
        } else if (payload.type === 'image') {
          result = await Share.shareImage({
            platform: info.platform, image: payload.image, thumb: payload.thumb,
          });
        } else {
          result = await Share.shareLink({
            platform: info.platform,
            title: payload.title,
            url: payload.url,
            description: payload.description,
            thumb: payload.thumb,
          });
        }
        shareSheetController.settle(result);
      } catch (err) {
        const ue = err instanceof UmengError
          ? err
          : new UmengError('E_UNKNOWN', String(err), err);
        shareSheetController.settleError(ue);
      }
    })();
  }, [state]);

  const handleCancel = useCallback(() => {
    shareSheetController.dismiss('cancel');
  }, []);

  if (!state.open) return null;

  const title = state.options.title ?? '分享至';
  const cancelText = state.options.cancelText ?? '取消';
  const subtitles = state.options.subtitles ?? {};
  const hideUninstalled = state.options.hideUninstalled ?? false;

  const visiblePlatforms = state.platforms.filter(
    (p) => !hideUninstalled || p.installed
  );

  return (
    <BottomSheet snapPoints={['30%']} grabber backdrop="scrim" onClose={handleCancel}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.c.foreground }]}>{title}</Text>
      </View>
      <View>
        {visiblePlatforms.map((info) => (
          <Cell
            key={info.platform}
            testID={`umeng-share-cell-${info.platform}`}
            title={info.displayName}
            desc={subtitles[info.platform] ?? PLATFORM_DEFAULT_SUBTITLES[info.platform]}
            leading={<PlatformLeading platform={info.platform} />}
            arrow
            disabled={!info.installed}
            onPress={() => handlePlatformPress(info)}
          />
        ))}
      </View>
      <Button
        testID="umeng-share-cancel"
        variant="secondary"
        size="lg"
        block
        label={cancelText}
        style={styles.cancel}
        onPress={handleCancel}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  head: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  cancel: { marginTop: 14 },
});
```

- [ ] **Step 4: 跑测试**

```bash
yarn test src/__tests__/ShareSheetHost.test.tsx
```

Expected: 2 tests PASS（测试用 mock 屏蔽了真实 design 系统）。

- [ ] **Step 5: Commit**

```bash
git add src/ShareSheet/ShareSheetHost.tsx src/__tests__/ShareSheetHost.test.tsx
git commit -m "feat(rn-ui): ShareSheetHost (BottomSheet + Cell × N + Button) with subtitles"
```

---

### Task 22: Share.openSheet API + index 导出 ShareSheetHost

**Files:**
- Modify: `src/share.ts`
- Modify: `src/index.ts`
- Modify: `src/__tests__/share.test.ts`（补 openSheet 测试）

- [ ] **Step 1: 在 src/share.ts 加 openSheet**

在 `src/share.ts` 末尾追加：

```ts
import { shareSheetController } from './ShareSheet/ShareSheetController';
import type { ShareSheetOptions, ShareSheetPayload } from './types';

export function openSheet(
  payload: ShareSheetPayload,
  options?: ShareSheetOptions
): Promise<ShareResult> {
  return shareSheetController.show(payload, options);
}
```

- [ ] **Step 2: 在 src/index.ts 加 ShareSheetHost 导出**

在 `src/index.ts` 末尾追加：

```ts
export { ShareSheetHost } from './ShareSheet/ShareSheetHost';
```

- [ ] **Step 3: 补 openSheet 测试**

在 `src/__tests__/share.test.ts` 末尾追加：

```ts
jest.mock('../ShareSheet/ShareSheetController', () => ({
  shareSheetController: { show: jest.fn() },
}));

describe('openSheet', () => {
  it('delegates to shareSheetController.show', async () => {
    const { shareSheetController } = require('../ShareSheet/ShareSheetController');
    (shareSheetController.show as jest.Mock).mockResolvedValue({
      code: 'success', platform: Platform.WECHAT_SESSION,
    });
    const r = await Share.openSheet({ type: 'text', text: 'hi' });
    expect(shareSheetController.show).toHaveBeenCalledWith(
      { type: 'text', text: 'hi' }, undefined
    );
    expect(r.code).toBe('success');
  });

  it('forwards options', async () => {
    const { shareSheetController } = require('../ShareSheet/ShareSheetController');
    (shareSheetController.show as jest.Mock).mockResolvedValue({
      code: 'success', platform: Platform.DINGTALK,
    });
    await Share.openSheet({ type: 'text', text: 'hi' }, { title: 'X' });
    expect(shareSheetController.show).toHaveBeenCalledWith(
      { type: 'text', text: 'hi' }, { title: 'X' }
    );
  });
});
```

- [ ] **Step 4: 跑全量测试 + typecheck**

```bash
yarn typecheck && yarn test
```

Expected: 全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/share.ts src/index.ts src/__tests__/share.test.ts
git commit -m "feat(rn-ui): Share.openSheet + export ShareSheetHost"
```

---

## 阶段 6 · example 工程 + README

### Task 23: example/package.json 加依赖

**Files:**
- Modify: `example/package.json`

- [ ] **Step 1: 改 example/package.json**

读当前 `example/package.json`，在 dependencies 加入：

```json
{
  "dependencies": {
    "@unif/react-native-design": "portal:../../react-native-design",
    "@gorhom/bottom-sheet": "^5.2.14",
    "react": "19.2.3",
    "react-native": "0.85.3",
    "react-native-gesture-handler": "^2.21.0",
    "react-native-svg": "^15.15.5"
  }
}
```

（保留已有 devDependencies；name 应为 `@unif/react-native-umeng-example`）

- [ ] **Step 2: 跑 yarn install 验证 portal: 链接**

```bash
yarn install
```

Expected: 成功，node_modules 链接到本地 react-native-design。

- [ ] **Step 3: Commit**

```bash
git add example/package.json yarn.lock
git commit -m "feat(example): wire @unif/react-native-design + bottom-sheet + svg deps"
```

---

### Task 24: example/src/App.tsx — 验证矩阵

**Files:**
- Modify: `example/src/App.tsx`

- [ ] **Step 1: 替换 example/src/App.tsx 整个内容**

```tsx
import { useState } from 'react';
import {
  ScrollView, View, Text, Button as RNButton, StyleSheet, Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import {
  Common, Share, Analytics, Platform, ShareSheetHost,
  type ShareResult, UmengError,
} from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <DemoScreen />
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function DemoScreen() {
  const [log, setLog] = useState<string>('—');
  const append = (line: string) => setLog((prev) => `${line}\n${prev}`.slice(0, 1200));

  const runShare = async (label: string, fn: () => Promise<ShareResult>) => {
    try {
      const r = await fn();
      append(`✓ ${label}: ${r.code}@${r.platform}`);
    } catch (e) {
      const code = e instanceof UmengError ? e.code : 'E_UNKNOWN';
      append(`✗ ${label}: ${code} – ${(e as Error).message}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={styles.h1}>@unif/react-native-umeng 验证矩阵</Text>

      <Section title="Common">
        <RNButton title="Common.init()（同意后调）" onPress={async () => {
          try { await Common.init(); append('✓ Common.init OK'); }
          catch (e) { append(`✗ Common.init: ${(e as Error).message}`); }
        }} />
        <RNButton title="Common.isInited()" onPress={async () => {
          const v = await Common.isInited();
          append(`Common.isInited → ${v}`);
        }} />
      </Section>

      <Section title="Share（命令式面板，主用例）">
        <RNButton title="openSheet · 链接" onPress={() => runShare('openSheet(link)', () =>
          Share.openSheet({
            type: 'link',
            title: 'Unif Umeng 示例',
            url: 'https://example.com',
            description: '从 RN 桥发起的链接卡片',
            thumb: 'https://example.com/thumb.png',
          })
        )} />
        <RNButton title="openSheet · 文本" onPress={() => runShare('openSheet(text)', () =>
          Share.openSheet({ type: 'text', text: 'Hello from Unif Umeng' })
        )} />
        <RNButton title="openSheet · 图片" onPress={() => runShare('openSheet(image)', () =>
          Share.openSheet({ type: 'image', image: 'https://example.com/x.png' })
        )} />
      </Section>

      <Section title="Share（底层直拉）">
        <RNButton title="shareLink → 微信会话（跳过面板）" onPress={() => runShare('shareLink', () =>
          Share.shareLink({
            platform: Platform.WECHAT_SESSION,
            title: 'Direct call',
            url: 'https://example.com',
            description: '不走面板的直拉',
          })
        )} />
      </Section>

      <Section title="Analytics">
        <RNButton title="onEvent('demo_event', { source: 'btn' })" onPress={() => {
          Analytics.onEvent('demo_event', { source: 'btn', count: 1 });
          append('Analytics.onEvent fired');
        }} />
        <RNButton title="signIn('demo-user-123', 'WX')" onPress={() => {
          Analytics.signIn('demo-user-123', 'WX');
          append('Analytics.signIn fired');
        }} />
        <RNButton title="signOut()" onPress={() => {
          Analytics.signOut();
          append('Analytics.signOut fired');
        }} />
      </Section>

      <Section title="日志">
        <Text style={styles.log}>{log}</Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.btns}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  h1: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  h2: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: '#666' },
  section: { marginBottom: 16 },
  btns: { gap: 6 },
  log: { fontFamily: 'Menlo', fontSize: 11, color: '#444' },
});
```

- [ ] **Step 2: Commit**

```bash
git add example/src/App.tsx
git commit -m "feat(example): full verification matrix (Common+Share+Analytics)"
```

---

### Task 25: README.md — 宿主集成完整文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 替换 README.md 整个内容**

```markdown
# @unif/react-native-umeng

友盟 React Native bridge：U-Share（微信会话 / 钉钉）+ U-App 移动统计。Unif 私有。

## 安装

```sh
yarn add @unif/react-native-umeng @unif/react-native-design @gorhom/bottom-sheet react-native-gesture-handler react-native-svg
```

## JS API

```ts
import {
  Common, Share, Analytics, Platform, ShareSheetHost,
} from '@unif/react-native-umeng';

// 1. 用户同意《隐私协议》后，启动数据采集
await Common.init();

// 2. 命令式分享面板（推荐）
const r = await Share.openSheet({
  type: 'link',
  title: '问问看',
  url: 'https://example.com',
  description: '一句话描述',
});
// r = { code: 'success' | 'cancel' | 'failed', platform, message? }

// 3. 跳过面板直拉
await Share.shareLink({
  platform: Platform.WECHAT_SESSION,
  title: 'T', url: 'https://x',
});

// 4. 统计
Analytics.onEvent('login', { channel: 'wechat' });
Analytics.signIn('user-123', 'WX');
Analytics.signOut();
```

## 宿主 App 集成

### 根组件挂载

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@unif/react-native-design';
import { ShareSheetHost } from '@unif/react-native-umeng';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <YourNavigationStack />
        <ShareSheetHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

### iOS

#### `ios/<App>/Info.plist`

```xml
<key>UMENG_APPKEY</key>
<string>YOUR_UMENG_APPKEY</string>
<key>UMENG_CHANNEL</key>
<string>App Store</string>

<key>UMENG_WECHAT_APPID</key>
<string>wxXXXXXXXX</string>
<key>UMENG_WECHAT_APPSECRET</key>
<string>XXXXXXXX</string>
<key>UMENG_WECHAT_UNIVERSAL_LINK</key>
<string>https://your.host/path/</string>

<key>UMENG_DINGTALK_APPID</key>
<string>dingoaXXXXXXXX</string>

<key>LSApplicationQueriesSchemes</key>
<array>
  <string>weixin</string>
  <string>weixinULAPI</string>
  <string>weixinURLParamsAPI</string>
  <string>wechat</string>
  <string>dingtalk</string>
  <string>dingtalk-open</string>
  <string>dingtalk-sso</string>
</array>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>weixin</string>
    <key>CFBundleURLSchemes</key>
    <array><string>wxXXXXXXXX</string></array>
  </dict>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>dingtalk</string>
    <key>CFBundleURLSchemes</key>
    <array><string>dingoaXXXXXXXX</string></array>
  </dict>
</array>
```

#### `ios/<App>/AppDelegate.swift`

```swift
import UIKit
// 注意：UmengBootstrap 是 @unif/react-native-umeng 桥导出的 Swift class
// 由桥 Pod 的 modular header 自动暴露，无需 bridging header

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ app: UIApplication, open url: URL,
                   options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return UmengBootstrap.shared.handleOpen(url, options: options)
  }

  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return UmengBootstrap.shared.handleUniversalLink(userActivity)
  }
}
```

#### `ios/Podfile`

```ruby
use_frameworks! :linkage => :static
use_modular_headers!

target 'YourApp' do
  config = use_native_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
    # 清掉 UMShare 6.11.1 的 EXCLUDED_ARCHS=arm64 simulator，让 Apple Silicon Mac 模拟器跑起来
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('UM')
        target.build_configurations.each do |config|
          config.build_settings.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
        end
      end
    end
  end
end
```

#### 微信 Universal Link

微信 SDK 1.8.6+ 强制 UL：到 Apple Developer 启用 Associated Domains，部署 `apple-app-site-association`，Entitlements 加 `applinks:your.host`。详见微信开放平台文档。

### Android

#### `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>

  <!-- Android 11+ 包可见性 -->
  <queries>
    <package android:name="com.tencent.mm"/>
    <package android:name="com.alibaba.android.rimet"/>
  </queries>

  <application>
    <meta-data android:name="UMENG_APPKEY" android:value="@string/umeng_appkey"/>
    <meta-data android:name="UMENG_CHANNEL" android:value="default"/>
    <meta-data android:name="UMENG_WECHAT_APPID" android:value="@string/wechat_appid"/>
    <meta-data android:name="UMENG_WECHAT_APPSECRET" android:value="@string/wechat_appsecret"/>
    <meta-data android:name="UMENG_DINGTALK_APPID" android:value="@string/dingtalk_appid"/>

    <!-- 微信回调 Activity（友盟提供基类，一行空类） -->
    <activity
      android:name=".wxapi.WXEntryActivity"
      android:configChanges="keyboardHidden|orientation|screenSize"
      android:exported="true"
      android:theme="@android:style/Theme.Translucent.NoTitleBar"/>

    <!-- 钉钉回调 Activity（必须叫 DDShareActivity；包路径固定） -->
    <activity
      android:name=".ddshare.DDShareActivity"
      android:configChanges="keyboardHidden|orientation|screenSize"
      android:exported="true"
      android:launchMode="singleInstance"
      android:theme="@android:style/Theme.Translucent.NoTitleBar"/>
  </application>
</manifest>
```

#### 微信回调 — `<appPkg>/wxapi/WXEntryActivity.kt`

```kotlin
package com.example.app.wxapi

import com.umeng.socialize.weixin.view.WXCallbackActivity

class WXEntryActivity : WXCallbackActivity()
```

#### 钉钉回调 — `<appPkg>/ddshare/DDShareActivity.kt`

```kotlin
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
    val appId = packageManager
      .getApplicationInfo(packageName, android.content.pm.PackageManager.GET_META_DATA)
      .metaData.getString("UMENG_DINGTALK_APPID") ?: ""
    iddShareApi = DDShareApiFactory.createDDShareApi(this, appId, false)
    iddShareApi.handleIntent(intent, this)
  }

  override fun onReq(req: BaseReq) {}
  override fun onResp(resp: BaseResp) {
    // 友盟 7.3.7 钉钉回调由 SDK 内部 hook，此处 finish 即可
    finish()
  }
}
```

#### 宿主 MainActivity — onActivityResult / onDestroy 转发

```kotlin
class MainActivity : ReactActivity() {
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    com.umeng.socialize.UMShareAPI.get(this).onActivityResult(requestCode, resultCode, data)
  }

  override fun onDestroy() {
    super.onDestroy()
    com.umeng.socialize.UMShareAPI.get(this).release()
  }
}
```

#### Proguard `app/proguard-rules.pro`

```pro
-dontwarn com.umeng.**
-keepattributes *Annotation*

-keep class com.umeng.** { *; }
-keep class com.uyumao.** { *; }
-keep class com.uc.** { *; }
-keep class com.ut.** { *; }
-keep class com.ta.** { *; }

-keep class com.tencent.mm.opensdk.** { *; }
-keep class com.tencent.wxop.** { *; }
-keep class com.tencent.mm.sdk.** { *; }
-keep class com.alibaba.android.** { *; }

-keep public class **.R$* { public static final int *; }
-keepclassmembers class * { public <init> (org.json.JSONObject); }
-keepclassmembers enum * {
  public static **[] values();
  public static ** valueOf(java.lang.String);
}
```

## 错误码

| code | 含义 |
| --- | --- |
| `E_PLATFORM_NOT_INSTALLED` | 微信/钉钉未安装 |
| `E_PLATFORM_NOT_SUPPORTED` | platform 字串不在白名单 |
| `E_INVALID_OPTIONS` | 参数缺失/类型错 |
| `E_USER_CANCEL` | 用户取消 |
| `E_SHARE_FAILED` | 友盟回调失败（含未配 URL Scheme、网络错等） |
| `E_NOT_INITIALIZED` | （预留） |
| `E_UNKNOWN` | 其它 |

## PIPL 合规

- **Android**：模块构造时自动 `UMConfigure.preInit`（不采集、不上报）；JS `Common.init()` 后才正式启动数据采集
- **iOS**：友盟 iOS SDK 无 preInit；JS `Common.init()` 之前桥不调任何友盟 API。请保证 `Common.init()` 在用户同意《隐私协议》之后调用

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): integration guide for host App (iOS + Android + Proguard)"
```

---

## 阶段 7 · 终结验证

### Task 26: lint + typecheck + test 全过 + 构建

**Files:** N/A（命令）

- [ ] **Step 1: lint**

```bash
yarn lint
```

Expected: 无 error。若有，按错误信息 fix 后重跑。

- [ ] **Step 2: typecheck**

```bash
yarn typecheck
```

Expected: 无 error。

- [ ] **Step 3: 单元测试全过**

```bash
yarn test
```

Expected: 所有 jest 测试 PASS（types / common / share / analytics / ShareSheetController / ShareSheetHost）。

- [ ] **Step 4: 库构建（bob）**

```bash
yarn prepare
```

Expected: 生成 `lib/module/` + `lib/typescript/`，无 error。

- [ ] **Step 5: example workspace 安装 + iOS pod**

```bash
cd example
yarn install
cd ios && bundle install && bundle exec pod install
cd ../..
```

Expected: cocoapods 解析成功，UMShare 6.11.1 + UMCommon 7.5.10 等被装上。

- [ ] **Step 6: example Android 构建**

```bash
yarn turbo run build:android
```

Expected: gradle 解析友盟 9.9.1 + 微信 6.8.34 + 钉钉 1.2.2 成功，apk 构建通过。

- [ ] **Step 7: example iOS 构建**

```bash
yarn turbo run build:ios
```

Expected: 构建成功。

- [ ] **Step 8: 最终 commit（如有 lint/typecheck/test 自动 fix 的变化）**

```bash
git status
git add -A
git diff --cached --stat
git commit -m "chore: pass lint/typecheck/test/prepare/iOS+Android build" --allow-empty
```

> 真机/模拟器手测见 spec §11 example 验证矩阵；这一步在 PR 前由开发人工跑（9 个分享按钮 + 5 个统计/初始化按钮，跑通微信会话 + 钉钉 happy path）。

---

## Self-Review 检查清单

执行计划的人在写代码时可对照 spec 节确认覆盖：

| Spec 节 | 实现 Task |
| --- | --- |
| §1.1 Common/Share/Analytics 范围 | Task 6/7/8/9 + 16/17/18 + 10/11/12/13 |
| §2 包元信息 | Task 1 (package.json) + Task 2 (podspec) + Task 3 (build.gradle) |
| §3 三个 TurboModule 架构 | Task 10–14（Android）+ Task 16–18（iOS）+ Task 5（spec） |
| §4 公共类型 | Task 4 |
| §5.1 Common JS API | Task 6 |
| §5.2 Share JS API + 5.4 index | Task 7 + 9 + 22 |
| §5.2.1 ShareSheet UI 规约 | Task 19 + 21 |
| §5.2.2 ShareSheetController | Task 20 |
| §5.3 Analytics | Task 8 |
| §6 codegen TurboModule spec | Task 5 |
| §7 SDK 依赖 | Task 2 (iOS) + Task 3 (Android) |
| §8 集成方配置 | Task 25 (README) |
| §9 PIPL 两端流程 | Task 10/15 + Task 11/16 |
| §10 错误码映射 | Task 7（JS）+ Task 13/18（native） |
| §11 example 验证矩阵 | Task 23 + 24 |
| §12 测试策略 | 各 task 含单测 + Task 26 集成构建 |
| §13 文件结构 | Task 1（改名）+ 各 Task 创建文件 |
| §14 落地步骤 | Task 1–26 全覆盖 |
| §15 风险与待确认 | 全部 risk 在对应 task 的注释/README 中体现（EXCLUDED_ARCHS / use_frameworks / setPlaform 拼写 / DD onResp 透传 / onActivityResult） |
