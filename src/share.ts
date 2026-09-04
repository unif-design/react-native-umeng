import NativeUmengShare from './NativeUmengShare';
import { shareSheetController } from './ShareSheet/ShareSheetController';
import { normalizeError } from './internal/errors';
import {
  Platform,
  PLATFORM_DISPLAY_NAMES,
  SUPPORTED_PLATFORMS,
  UmengError,
  type PlatformInfo,
  type ShareImageOptions,
  type ShareLinkOptions,
  type ShareResult,
  type ShareSheetOptions,
  type ShareSheetPayload,
  type ShareTextOptions,
} from './types';

type UnknownRecord = Record<string, unknown>;

function invalidOptions(message: string): never {
  throw new UmengError('E_INVALID_OPTIONS', message);
}

function requireObject(value: unknown, field: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidOptions(`\`${field}\` must be an object`);
  }
  return value as UnknownRecord;
}

function assertSupportedPlatform(value: unknown): asserts value is Platform {
  if (
    typeof value !== 'string' ||
    !SUPPORTED_PLATFORMS.includes(value as Platform)
  ) {
    throw new UmengError(
      'E_PLATFORM_NOT_SUPPORTED',
      `Platform '${String(value)}' is not supported`
    );
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return invalidOptions(`\`${field}\` must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireString(value, field);
}

function requireHttpUrl(value: unknown, field: string): string {
  const urlString = requireString(value, field);
  try {
    const url = new URL(urlString);
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname.length > 0
    ) {
      return urlString;
    }
  } catch {
    // 统一在下方抛稳定的参数错误。
  }
  return invalidOptions(
    `\`${field}\` must be an absolute HTTP or HTTPS URL with a host`
  );
}

function optionalHttpUrl(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireHttpUrl(value, field);
}

function invalidNativeResult(value: unknown): never {
  throw new UmengError(
    'E_UNKNOWN',
    'Native share returned an invalid result',
    value
  );
}

function settleNativeResult(
  value: unknown,
  requestedPlatform: Platform
): ShareResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidNativeResult(value);
  }

  const result = value as UnknownRecord;
  const { code, message, platform } = result;
  if (code !== 'success' && code !== 'cancel' && code !== 'failed') {
    return invalidNativeResult(value);
  }
  if (
    typeof platform !== 'string' ||
    !SUPPORTED_PLATFORMS.includes(platform as Platform) ||
    platform !== requestedPlatform
  ) {
    return invalidNativeResult(value);
  }
  if (message !== undefined && typeof message !== 'string') {
    return invalidNativeResult(value);
  }

  if (code === 'cancel') {
    throw new UmengError(
      'E_USER_CANCEL',
      message !== undefined && message.trim().length > 0
        ? message
        : 'User cancelled',
      value
    );
  }
  if (code === 'failed') {
    throw new UmengError(
      'E_SHARE_FAILED',
      message !== undefined && message.trim().length > 0
        ? message
        : 'Share failed',
      value
    );
  }

  return message === undefined
    ? { code: 'success', platform: requestedPlatform }
    : { code: 'success', message, platform: requestedPlatform };
}

function validateSheetPayload(payload: unknown): ShareSheetPayload {
  const input = requireObject(payload, 'payload');

  switch (input.type) {
    case 'text':
      return { type: 'text', text: requireString(input.text, 'text') };
    case 'image': {
      const thumb = optionalHttpUrl(input.thumb, 'thumb');
      return thumb === undefined
        ? { type: 'image', image: requireHttpUrl(input.image, 'image') }
        : {
            type: 'image',
            image: requireHttpUrl(input.image, 'image'),
            thumb,
          };
    }
    case 'link': {
      const description = optionalString(input.description, 'description');
      const thumb = optionalHttpUrl(input.thumb, 'thumb');
      return {
        type: 'link',
        title: requireString(input.title, 'title'),
        url: requireHttpUrl(input.url, 'url'),
        ...(description === undefined ? {} : { description }),
        ...(thumb === undefined ? {} : { thumb }),
      };
    }
    default:
      return invalidOptions(
        '`payload.type` must be one of "text", "image", or "link"'
      );
  }
}

function validateSheetOptions(options: unknown): ShareSheetOptions {
  if (options === undefined) {
    return {};
  }

  const input = requireObject(options, 'options');
  optionalString(input.title, 'title');
  optionalString(input.cancelText, 'cancelText');
  if (
    input.hideUninstalled !== undefined &&
    typeof input.hideUninstalled !== 'boolean'
  ) {
    return invalidOptions('`hideUninstalled` must be a boolean');
  }
  if (
    input.presentation !== undefined &&
    input.presentation !== 'modal' &&
    input.presentation !== 'floating'
  ) {
    return invalidOptions(
      '`presentation` must be one of "modal" or "floating"'
    );
  }
  if (input.onDismiss !== undefined && typeof input.onDismiss !== 'function') {
    return invalidOptions('`onDismiss` must be a function');
  }
  if (
    input.onSheetLayout !== undefined &&
    typeof input.onSheetLayout !== 'function'
  ) {
    return invalidOptions('`onSheetLayout` must be a function');
  }
  if (input.subtitles !== undefined) {
    const subtitles = requireObject(input.subtitles, 'subtitles');
    for (const [platform, subtitle] of Object.entries(subtitles)) {
      if (!SUPPORTED_PLATFORMS.includes(platform as Platform)) {
        return invalidOptions(
          `\`subtitles.${platform}\` is not a supported platform`
        );
      }
      requireString(subtitle, `subtitles.${platform}`);
    }
  }

  return options as ShareSheetOptions;
}

export async function shareText(
  options: ShareTextOptions
): Promise<ShareResult> {
  const fallbackMessage = 'Failed to share text';

  try {
    const input = requireObject(options, 'options');
    const platform = input.platform;
    assertSupportedPlatform(platform);
    const text = requireString(input.text, 'text');
    const result: unknown = await NativeUmengShare.shareText(platform, text);
    return settleNativeResult(result, platform);
  } catch (error) {
    throw normalizeError(error, 'E_SHARE_FAILED', fallbackMessage);
  }
}

export async function shareImage(
  options: ShareImageOptions
): Promise<ShareResult> {
  const fallbackMessage = 'Failed to share image';

  try {
    const input = requireObject(options, 'options');
    const platform = input.platform;
    assertSupportedPlatform(platform);
    const image = requireHttpUrl(input.image, 'image');
    const thumb = optionalHttpUrl(input.thumb, 'thumb');
    const result: unknown = await NativeUmengShare.shareImage(
      platform,
      image,
      thumb
    );
    return settleNativeResult(result, platform);
  } catch (error) {
    throw normalizeError(error, 'E_SHARE_FAILED', fallbackMessage);
  }
}

export async function shareLink(
  options: ShareLinkOptions
): Promise<ShareResult> {
  const fallbackMessage = 'Failed to share link';

  try {
    const input = requireObject(options, 'options');
    const platform = input.platform;
    assertSupportedPlatform(platform);
    const title = requireString(input.title, 'title');
    const url = requireHttpUrl(input.url, 'url');
    const description = optionalString(input.description, 'description');
    const thumb = optionalHttpUrl(input.thumb, 'thumb');
    const result: unknown = await NativeUmengShare.shareLink(
      platform,
      title,
      url,
      description,
      thumb
    );
    return settleNativeResult(result, platform);
  } catch (error) {
    throw normalizeError(error, 'E_SHARE_FAILED', fallbackMessage);
  }
}

export async function isInstalled(platform: Platform): Promise<boolean> {
  const fallbackMessage = 'Failed to query platform installation state';

  try {
    assertSupportedPlatform(platform);
    const result: unknown = await NativeUmengShare.isInstalled(platform);
    if (typeof result !== 'boolean') {
      throw new UmengError('E_UNKNOWN', fallbackMessage, result);
    }
    return result;
  } catch (error) {
    throw normalizeError(error, 'E_UNKNOWN', fallbackMessage);
  }
}

export async function listPlatforms(): Promise<PlatformInfo[]> {
  const fallbackMessage = 'Failed to list share platforms';

  try {
    const installs = await Promise.all(
      SUPPORTED_PLATFORMS.map((platform) => isInstalled(platform))
    );
    return SUPPORTED_PLATFORMS.map((platform, index) => ({
      platform,
      installed: installs[index] ?? false,
      displayName: PLATFORM_DISPLAY_NAMES[platform],
    }));
  } catch (error) {
    throw normalizeError(error, 'E_UNKNOWN', fallbackMessage);
  }
}

/**
 * 命令式拉起分享面板（推荐用法）。
 * 必须在应用根挂载 `<ShareSheetHost />`，否则 Promise 立即 reject。
 */
export async function openSheet(
  payload: ShareSheetPayload,
  options?: ShareSheetOptions
): Promise<ShareResult> {
  const fallbackMessage = 'Failed to open share sheet';
  let validatedPayload: ShareSheetPayload;
  let validatedOptions: ShareSheetOptions;

  try {
    validatedPayload = validateSheetPayload(payload);
    validatedOptions = validateSheetOptions(options);
  } catch (error) {
    const rawOptions =
      typeof options === 'object' && options !== null
        ? (options as Record<string, unknown>)
        : null;
    if (typeof rawOptions?.onDismiss === 'function') {
      rawOptions.onDismiss();
    }
    throw normalizeError(error, 'E_UNKNOWN', fallbackMessage);
  }

  try {
    return await shareSheetController.show(validatedPayload, validatedOptions);
  } catch (error) {
    throw normalizeError(error, 'E_UNKNOWN', fallbackMessage);
  }
}
