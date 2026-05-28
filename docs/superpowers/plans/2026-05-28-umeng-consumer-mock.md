# umeng 消费者 jest mock 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `@unif/react-native-umeng` 加 `@unif/react-native-umeng/mock` 子入口,1:1 stub 公共 API,让消费者 jest 测试 import 本库不崩、且可 spy/断言。

**Architecture:** 对齐兄弟仓库 `@unif/react-native-camera`:新增 `src/mock.ts`(bob 编译进 lib),`exports["./mock"]` 暴露;mock 不 import `./index`(避免拉起 native),纯量/类型从 `./types` 真实 re-export,native 接口用 `jest.fn()` stub。

**Tech Stack:** TypeScript、react-native-builder-bob、jest、@types/jest(均已在 devDeps)。

参考 spec:`docs/superpowers/specs/2026-05-28-umeng-consumer-mock-design.md`
参考范本:`/Users/liulijun/tongyi/unif/react-native-camera/src/mock.ts`、`.../src/__tests__/mock.test.ts`

---

### Task 1: 新增 `src/mock.ts` + 自测(TDD)

**Files:**
- Create: `src/__tests__/mock.test.ts`
- Create: `src/mock.ts`

- [ ] **Step 1: 写失败测试 `src/__tests__/mock.test.ts`**

```ts
import {
  Common,
  Share,
  Analytics,
  ShareSheetHost,
  Platform,
  SUPPORTED_PLATFORMS,
  UmengError,
  shareSuccess,
  shareCancel,
} from '../mock';

describe('mock', () => {
  it('Common/Share/Analytics 方法都是 jest mock', () => {
    expect(jest.isMockFunction(Common.preInit)).toBe(true);
    expect(jest.isMockFunction(Common.init)).toBe(true);
    expect(jest.isMockFunction(Common.isInited)).toBe(true);
    expect(jest.isMockFunction(Share.shareText)).toBe(true);
    expect(jest.isMockFunction(Share.openSheet)).toBe(true);
    expect(jest.isMockFunction(Analytics.onEvent)).toBe(true);
  });

  it('Common.isInited 默认 false', async () => {
    await expect(Common.isInited()).resolves.toBe(false);
  });

  it('Share.shareText 默认 success', async () => {
    await expect(
      Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' })
    ).resolves.toEqual({ code: 'success', platform: Platform.WECHAT_SESSION });
  });

  it('结果可按单次调用覆盖', async () => {
    (Share.shareText as jest.Mock).mockResolvedValueOnce(
      shareCancel(Platform.DINGTALK)
    );
    await expect(
      Share.shareText({ platform: Platform.DINGTALK, text: 'hi' })
    ).resolves.toEqual({ code: 'cancel', platform: Platform.DINGTALK });
  });

  it('listPlatforms 返回全平台 installed', async () => {
    await expect(Share.listPlatforms()).resolves.toEqual(
      SUPPORTED_PLATFORMS.map((platform) => ({
        platform,
        installed: true,
        displayName: expect.any(String),
      }))
    );
  });

  it('ShareSheetHost 渲染 null', () => {
    expect(ShareSheetHost({})).toBeNull();
  });

  it('纯导出仍是真实值', () => {
    expect(Platform.WECHAT_SESSION).toBe('wechat_session');
    expect(new UmengError('E_UNKNOWN', 'x')).toBeInstanceOf(Error);
    expect(shareSuccess(Platform.DINGTALK)).toEqual({
      code: 'success',
      platform: Platform.DINGTALK,
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/__tests__/mock.test.ts`
Expected: FAIL — `Cannot find module '../mock'`。

- [ ] **Step 3: 实现 `src/mock.ts`**

```ts
// Jest mock for @unif/react-native-umeng —— 供消费者在测试中替换本库,
// 避免 jest 环境加载 NativeUmeng* TurboModule / @unif/react-native-design 而崩溃。
//
// 用法(消费者 jest setup 或单个测试文件):
//
//   jest.mock('@unif/react-native-umeng', () =>
//     require('@unif/react-native-umeng/mock')
//   );
//
// 替换后 Common/Share/Analytics 方法都是 jest.fn;share* 默认 resolve 成功。
// 按需覆盖单次返回:
//   (Share.shareText as jest.Mock).mockResolvedValueOnce(shareCancel(Platform.WECHAT_SESSION));

import type { FC } from 'react';
import { Platform, SUPPORTED_PLATFORMS, PLATFORM_DISPLAY_NAMES } from './types';
import type {
  ShareResult,
  PlatformInfo,
  ShareTextOptions,
  ShareImageOptions,
  ShareLinkOptions,
  ShareSheetPayload,
  ShareSheetOptions,
  UmengInitConfig,
} from './types';

// 纯 JS 常量 + 类型 + Error 类:保留真实实现(不碰 native)。同 index 暴露的那批。
export * from './types';

// ---- 结果助手:success / cancel / failed 一行可得 ----
export const shareSuccess = (platform: Platform): ShareResult => ({
  code: 'success',
  platform,
});
export const shareCancel = (platform: Platform): ShareResult => ({
  code: 'cancel',
  platform,
});
export const shareFailed = (
  platform: Platform,
  message = 'mock failed'
): ShareResult => ({ code: 'failed', platform, message });

// ---- Common ----
export const Common = {
  preInit: jest.fn((_config: UmengInitConfig): Promise<void> => Promise.resolve()),
  init: jest.fn((): Promise<void> => Promise.resolve()),
  isInited: jest.fn((): Promise<boolean> => Promise.resolve(false)),
  __resetForTests: jest.fn((): void => {}),
};

// ---- Share ----（默认全 happy-path,消费者用 helper / mockResolvedValueOnce 覆盖）
export const Share = {
  shareText: jest.fn((o: ShareTextOptions): Promise<ShareResult> =>
    Promise.resolve(shareSuccess(o.platform))
  ),
  shareImage: jest.fn((o: ShareImageOptions): Promise<ShareResult> =>
    Promise.resolve(shareSuccess(o.platform))
  ),
  shareLink: jest.fn((o: ShareLinkOptions): Promise<ShareResult> =>
    Promise.resolve(shareSuccess(o.platform))
  ),
  openSheet: jest.fn(
    (
      _payload: ShareSheetPayload,
      _options?: ShareSheetOptions
    ): Promise<ShareResult> =>
      Promise.resolve(shareSuccess(SUPPORTED_PLATFORMS[0]))
  ),
  isInstalled: jest.fn((_platform: Platform): Promise<boolean> =>
    Promise.resolve(true)
  ),
  listPlatforms: jest.fn((): Promise<PlatformInfo[]> =>
    Promise.resolve(
      SUPPORTED_PLATFORMS.map((platform) => ({
        platform,
        installed: true,
        displayName: PLATFORM_DISPLAY_NAMES[platform],
      }))
    )
  ),
};

// ---- Analytics ----（同步 void,bare jest.fn 即可)
export const Analytics = {
  onEvent: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
};

// ---- ShareSheetHost ----（不引 design,渲染 null)
export const ShareSheetHost: FC = () => null;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/__tests__/mock.test.ts`
Expected: PASS(全部 it 绿)。

- [ ] **Step 5: typecheck(裸 jest.fn 须过)**

Run: `yarn typecheck`
Expected: 无输出、退出 0。若报 `Cannot find name 'jest'`,在 `src/mock.ts` 首行加 `/// <reference types="jest" />` 后重跑。

- [ ] **Step 6: commit**

```bash
git add src/mock.ts src/__tests__/mock.test.ts
git commit -m "feat: 加 @unif/react-native-umeng/mock 消费者 jest mock"
```

---

### Task 2: 暴露 `./mock` 子入口 + 构建验证

**Files:**
- Modify: `package.json`(`exports` 块)

- [ ] **Step 1: 给 `package.json` 的 `exports` 加 `./mock`**

把:
```json
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./lib/typescript/src/index.d.ts",
      "default": "./lib/module/index.js"
    },
    "./package.json": "./package.json"
  },
```
改成:
```json
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./lib/typescript/src/index.d.ts",
      "default": "./lib/module/index.js"
    },
    "./mock": {
      "source": "./src/mock.ts",
      "types": "./lib/typescript/src/mock.d.ts",
      "default": "./lib/module/mock.js"
    },
    "./package.json": "./package.json"
  },
```
(`files` 不用改:`src`/`lib` 已含,`mock.ts` 不在 `!**/__mocks__`/`!**/__tests__` 排除内。)

- [ ] **Step 2: 构建,确认产出 mock 文件**

Run: `yarn prepare && ls lib/module/mock.js lib/typescript/src/mock.d.ts`
Expected: 两个文件都列出(bob 编译产物存在)。

- [ ] **Step 3: commit**

```bash
git add package.json
git commit -m "feat: exports 暴露 ./mock 子入口"
```

---

### Task 3: README 加「测试 / Mocking」节

**Files:**
- Modify: `README.md`(在 `## 错误码` 之前插入新节)

- [ ] **Step 1: 在 `README.md` 的 `## 错误码` 行之前插入**

```markdown
## 测试 / Mocking

宿主 App 用 jest 测自己代码时,`@unif/react-native-umeng` 的 native 绑定在 jest 里加载会崩。库提供了开箱 mock,一行替换:

\`\`\`ts
// jest setup 或单个测试文件
jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'));
\`\`\`

替换后:`Common`/`Share`/`Analytics` 方法都是 `jest.fn`,`Share.*` 默认 resolve 成功,`Common.isInited()` 默认 `false`,`ShareSheetHost` 渲染 `null`,纯枚举/常量(`Platform` 等)与 `UmengError` 仍是真实值。

按需覆盖结果(mock 另导出 `shareSuccess/shareCancel/shareFailed` 助手):

\`\`\`ts
import { Share, Platform } from '@unif/react-native-umeng';
import { shareCancel } from '@unif/react-native-umeng/mock';

(Share.shareText as jest.Mock).mockResolvedValueOnce(shareCancel(Platform.WECHAT_SESSION));
\`\`\`

```

(注意:上面 markdown 里的 ` ``` ` 围栏在实际写入 README 时是普通三反引号,不要带反斜杠转义。)

- [ ] **Step 2: commit**

```bash
git add README.md
git commit -m "docs: README 加测试 / mock 用法"
```

---

### Task 4: 全量验证 + 推送

- [ ] **Step 1: 全量验证**

Run: `yarn lint && yarn typecheck && yarn test`
Expected: 三者全绿(mock.test 通过,无 lint/类型错)。

- [ ] **Step 2: 推送分支**

```bash
git push -u origin feat/jest-mock-export
```

- [ ] **Step 3: 开 PR**

环境无 `gh`:用 push 输出里的 compare URL 手动开 PR。标题走 conventional(如 `feat: 加消费者 jest mock 子入口 @unif/react-native-umeng/mock`)。

> 合并提醒:本 PR 动了 `src/` + `package.json`(release.yml 的 paths)→ 合并后自动发一个 patch 版(consumer-facing 增强,合适)。

---

## 范围(YAGNI)
- 只做消费者 mock。不改 umeng 现有 `__tests__` inline mock(留小 follow-up)。不做跨 @unif 统一 mock。
