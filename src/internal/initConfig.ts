import { UmengError } from '../types';

export interface NormalizedUmengInitConfig {
  readonly appkey: string;
  readonly channel: string | undefined;
  readonly wechatAppId: string | undefined;
  readonly wechatAppSecret: string | undefined;
  readonly wechatUniversalLink: string | undefined;
  readonly dingtalkAppId: string | undefined;
}

type InitConfigInput = Record<string, unknown>;

function invalidConfig(message: string): never {
  throw new UmengError('E_INVALID_OPTIONS', message);
}

function normalizeOptionalString(
  value: unknown,
  field: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return invalidConfig(`\`${field}\` must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return invalidConfig(`\`${field}\` must not be empty`);
  }
  return normalized;
}

function isValidUniversalLink(link: string): boolean {
  if (!/^https:\/\//i.test(link)) {
    return false;
  }

  try {
    const url = new URL(link);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function normalizeInitConfig(
  config: unknown,
  os: 'android' | 'ios'
): Readonly<NormalizedUmengInitConfig> {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return invalidConfig('`config` must be an object');
  }

  const input = config as InitConfigInput;
  const appkey = normalizeOptionalString(input.appkey, 'appkey');
  if (appkey === undefined) {
    return invalidConfig('`appkey` is required');
  }

  const channel = normalizeOptionalString(input.channel, 'channel');
  const wechatAppId = normalizeOptionalString(input.wechatAppId, 'wechatAppId');
  const wechatAppSecret = normalizeOptionalString(
    input.wechatAppSecret,
    'wechatAppSecret'
  );
  const wechatUniversalLink = normalizeOptionalString(
    input.wechatUniversalLink,
    'wechatUniversalLink'
  );
  const dingtalkAppId = normalizeOptionalString(
    input.dingtalkAppId,
    'dingtalkAppId'
  );

  const hasWeChatConfig =
    wechatAppId !== undefined ||
    wechatAppSecret !== undefined ||
    wechatUniversalLink !== undefined;
  if (hasWeChatConfig) {
    if (wechatAppId === undefined || wechatAppSecret === undefined) {
      return invalidConfig(
        '`wechatAppId` and `wechatAppSecret` must be provided together'
      );
    }
    if (os === 'ios' && wechatUniversalLink === undefined) {
      return invalidConfig('`wechatUniversalLink` is required on iOS');
    }
  }

  if (
    wechatUniversalLink !== undefined &&
    !isValidUniversalLink(wechatUniversalLink)
  ) {
    return invalidConfig(
      '`wechatUniversalLink` must be an absolute HTTPS URL with a host'
    );
  }

  return Object.freeze({
    appkey,
    channel,
    wechatAppId,
    wechatAppSecret,
    wechatUniversalLink,
    dingtalkAppId,
  });
}

export function areInitConfigsEqual(
  left: NormalizedUmengInitConfig,
  right: NormalizedUmengInitConfig
): boolean {
  return (
    left.appkey === right.appkey &&
    left.channel === right.channel &&
    left.wechatAppId === right.wechatAppId &&
    left.wechatAppSecret === right.wechatAppSecret &&
    left.wechatUniversalLink === right.wechatUniversalLink &&
    left.dingtalkAppId === right.dingtalkAppId
  );
}

export function toNativeInitConfig(config: NormalizedUmengInitConfig): object {
  const nativeConfig: Record<string, string> = { appkey: config.appkey };

  if (config.channel !== undefined) {
    nativeConfig.channel = config.channel;
  }
  if (config.wechatAppId !== undefined) {
    nativeConfig.wechatAppId = config.wechatAppId;
  }
  if (config.wechatAppSecret !== undefined) {
    nativeConfig.wechatAppSecret = config.wechatAppSecret;
  }
  if (config.wechatUniversalLink !== undefined) {
    nativeConfig.wechatUniversalLink = config.wechatUniversalLink;
  }
  if (config.dingtalkAppId !== undefined) {
    nativeConfig.dingtalkAppId = config.dingtalkAppId;
  }

  return nativeConfig;
}
