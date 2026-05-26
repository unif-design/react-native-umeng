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
    throw new UmengError(
      'E_PLATFORM_NOT_SUPPORTED',
      `Platform '${p}' is not supported`
    );
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

export async function shareText(
  options: ShareTextOptions
): Promise<ShareResult> {
  assertSupportedPlatform(options.platform);
  if (!options.text) {
    throw new UmengError(
      'E_INVALID_OPTIONS',
      '`text` is required for shareText'
    );
  }
  const n = await NativeUmengShare.shareText(options.platform, options.text);
  return settle(n);
}

export async function shareImage(
  options: ShareImageOptions
): Promise<ShareResult> {
  assertSupportedPlatform(options.platform);
  if (!options.image) {
    throw new UmengError(
      'E_INVALID_OPTIONS',
      '`image` is required for shareImage'
    );
  }
  const n = await NativeUmengShare.shareImage(
    options.platform,
    options.image,
    options.thumb
  );
  return settle(n);
}

export async function shareLink(
  options: ShareLinkOptions
): Promise<ShareResult> {
  assertSupportedPlatform(options.platform);
  if (!options.title) {
    throw new UmengError(
      'E_INVALID_OPTIONS',
      '`title` is required for shareLink'
    );
  }
  if (!options.url) {
    throw new UmengError(
      'E_INVALID_OPTIONS',
      '`url` is required for shareLink'
    );
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
