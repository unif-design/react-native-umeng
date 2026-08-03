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
//   (Share.shareText as jest.Mock).mockRejectedValueOnce(shareCancel(Platform.WECHAT_SESSION));

import type { FC } from 'react';
import {
  Platform,
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  UmengError,
} from './types';
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
export const shareCancel = (platform: Platform): UmengError =>
  new UmengError('E_USER_CANCEL', 'User cancelled', { platform });
export const shareFailed = (
  platform: Platform,
  message = 'mock failed'
): UmengError => new UmengError('E_SHARE_FAILED', message, { platform });

// ---- Common ----
export const Common = {
  preInit: jest.fn(
    (_config: UmengInitConfig): Promise<void> => Promise.resolve()
  ),
  init: jest.fn((): Promise<void> => Promise.resolve()),
  isInited: jest.fn((): Promise<boolean> => Promise.resolve(false)),
};

// ---- Share ----（默认 happy-path,消费者用 helper / mockRejectedValueOnce 覆盖）
export const Share = {
  shareText: jest.fn(
    (o: ShareTextOptions): Promise<ShareResult> =>
      Promise.resolve(shareSuccess(o.platform))
  ),
  shareImage: jest.fn(
    (o: ShareImageOptions): Promise<ShareResult> =>
      Promise.resolve(shareSuccess(o.platform))
  ),
  shareLink: jest.fn(
    (o: ShareLinkOptions): Promise<ShareResult> =>
      Promise.resolve(shareSuccess(o.platform))
  ),
  openSheet: jest.fn(
    (
      _payload: ShareSheetPayload,
      _options?: ShareSheetOptions
    ): Promise<ShareResult> =>
      Promise.resolve(shareSuccess(Platform.WECHAT_SESSION))
  ),
  isInstalled: jest.fn(
    (_platform: Platform): Promise<boolean> => Promise.resolve(true)
  ),
  listPlatforms: jest.fn(
    (): Promise<PlatformInfo[]> =>
      Promise.resolve(
        SUPPORTED_PLATFORMS.map((platform) => ({
          platform,
          installed: true,
          displayName: PLATFORM_DISPLAY_NAMES[platform],
        }))
      )
  ),
};

// ---- Analytics ----（同步 void）
export const Analytics = {
  onEvent: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
};

// ---- ShareSheetHost ----（不引 design,渲染 null）
export const ShareSheetHost: FC = () => null;
