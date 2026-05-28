# `@unif/react-native-umeng` 消费者 jest mock — 设计

## Context

本库是 turbo-module,公共 API 大半由 `NativeUmengCommon/Share/Analytics` TurboModule 支撑,`ShareSheetHost` 还 `import '@unif/react-native-design'`。宿主 App 用 jest 测自己代码、`import '@unif/react-native-umeng'` 时,这些 native 绑定在 jest 环境加载会崩,目前消费者只能各自手写 mock。库未提供任何 mock(`exports` 仅 `.`)。

目标:加一个 `@unif/react-native-umeng/mock` 子入口,1:1 stub 公共 API,消费者一行接入。纯 umeng 改动。

兄弟仓库 **`@unif/react-native-camera` 已确立范式**:`exports["./mock"] → src/mock.ts`(bob 编译)+ `src/__tests__/mock.test.ts`。本设计对齐它。

## 形态(对齐 camera)

- 新增 `src/mock.ts` → bob 编出 `lib/module/mock.js` + `lib/typescript/src/mock.d.ts`。
- `package.json` `exports` 加 `"./mock"`(source/types/default,与 camera 同构);`files` 不动(src/lib 已含)。
- **不 import `./index`**(会拉起 native 依赖链,失去 mock 意义)。
- 裸 `jest.fn()`(靠 @types/jest 全局,同 camera;若 typecheck 报 jest 未定义才加 `/// <reference types="jest" />`)。
- `jest.fn(...)` 用 `as` 转成真实 API 类型,保证类型对齐。

## 导出(与 `src/index.ts` 严格 1:1)

- `export * from './types'` —— `Platform / SUPPORTED_PLATFORMS / PLATFORM_DISPLAY_NAMES / PLATFORM_DEFAULT_SUBTITLES / PLATFORM_BRAND_COLORS / UmengError` + 所有 `type`,**真实** re-export(纯 JS、不碰 native;同 camera 的 `export * from './utils'`)。
- `Common`:`preInit/init → jest.fn(()=>Promise.resolve())`、`isInited → jest.fn(()=>Promise.resolve(false))`、`__resetForTests → jest.fn()`
- `Share`:`shareText/shareImage/shareLink → jest.fn(o => Promise.resolve(shareSuccess(o.platform)))`、`openSheet → jest.fn(()=>Promise.resolve(shareSuccess(SUPPORTED_PLATFORMS[0])))`、`isInstalled → jest.fn(()=>Promise.resolve(true))`、`listPlatforms → jest.fn(()=>Promise.resolve(全平台 {platform, installed:true, displayName}))`
- `Analytics`:`onEvent/signIn/signOut → jest.fn()`
- `ShareSheetHost`:`() => null`(不引 design,mock 自包含)

## 结果助手(success / cancel / failed 三种结果都一行可得)

```ts
export const shareSuccess = (platform: Platform): ShareResult => ({ code: 'success', platform });
export const shareCancel  = (platform: Platform): ShareResult => ({ code: 'cancel',  platform });
export const shareFailed  = (platform: Platform, message = 'mock failed'): ShareResult =>
  ({ code: 'failed', platform, message });
```

`Share.*` 默认 resolve `shareSuccess(...)`(happy path);消费者按需切换:

```ts
(Share.shareText as jest.Mock).mockResolvedValueOnce(shareCancel(Platform.WECHAT_SESSION));
(Share.shareLink as jest.Mock).mockRejectedValueOnce(new UmengError('E_SHARE_FAILED', 'x'));
```

## 消费者用法(README 新增「测试 / Mocking」节)

```ts
jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'));
```

替换后 import 不崩、share 默认成功;测 cancel/failed/未初始化用上面的 helper / `mockResolvedValueOnce` / `mockRejectedValueOnce`。

## 自测 / dogfood

新增 `src/__tests__/mock.test.ts`(仿 camera mock.test):
- 导出齐全(`Common/Share/Analytics/ShareSheetHost/Platform/SUPPORTED_PLATFORMS/UmengError` + 三个 helper)。
- `jest.isMockFunction(Share.shareText)` 为 true。
- 默认 `Share.shareText({platform})` resolve `{code:'success'}`;`Common.isInited()` resolve `false`。
- `mockResolvedValueOnce(shareCancel(p))` 可覆盖。
- 纯 re-export 仍是真实值:`Platform.WECHAT_SESSION === 'wechat_session'`、`new UmengError(...)` instanceof Error。

## 验证

- `yarn typecheck`(裸 jest.fn 须过)
- `yarn test`(mock.test 全绿)
- `yarn prepare`(bob 产出 `lib/module/mock.js` + `lib/typescript/src/mock.d.ts`)

## 范围(YAGNI)

- 只做消费者 mock。
- 不改 umeng 现有 `__tests__` 的 inline mock(留小 follow-up,可后续 dogfood)。
- 不做跨 @unif 统一 mock 约定。

## 注意

- 改了 `src/` + `package.json`(都在 release.yml 的 paths)→ 合并后自动发一个 patch 版(consumer-facing 增强)。
