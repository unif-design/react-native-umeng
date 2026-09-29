import { UmengError } from '../../UmengError';
import { isHttpUrl } from '../isHttpUrl';

import type { NormalizedUmengInitConfig, InitConfigInput } from './types';

function invalidConfig(message: string): never {
  throw new UmengError({ reason: 'invalid_input', message });
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
  return /^https:\/\//i.test(link) && isHttpUrl(link);
}

export function normalizeInitConfig(
  config: unknown,
  os: 'android' | 'ios'
): Readonly<NormalizedUmengInitConfig> {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return invalidConfig('`config` must be an object');
  }

  const input = config as InitConfigInput;
  for (const key of ['wechat', 'dingtalk']) {
    const value = input[key];
    if (
      value !== undefined &&
      (typeof value !== 'object' || value === null || Array.isArray(value))
    ) {
      return invalidConfig(`\`${key}\` must be an object`);
    }
  }
  const wechat = input.wechat as InitConfigInput | undefined;
  const dingtalk = input.dingtalk as InitConfigInput | undefined;
  const appkey = normalizeOptionalString(input.appKey, 'appKey');
  if (appkey === undefined) {
    return invalidConfig('`appKey` is required');
  }

  const channel = normalizeOptionalString(input.channel, 'channel');
  const wechatAppId = normalizeOptionalString(wechat?.appId, 'wechat.appId');
  const wechatAppSecret = normalizeOptionalString(
    wechat?.appSecret,
    'wechat.appSecret'
  );
  const wechatUniversalLink = normalizeOptionalString(
    wechat?.universalLink,
    'wechat.universalLink'
  );
  const dingtalkAppId = normalizeOptionalString(
    dingtalk?.appId,
    'dingtalk.appId'
  );

  const hasWeChatConfig = wechat !== undefined;
  if (hasWeChatConfig) {
    if (wechatAppId === undefined || wechatAppSecret === undefined) {
      return invalidConfig(
        '`wechat.appId` and `wechat.appSecret` must be provided together'
      );
    }
    if (os === 'ios' && wechatUniversalLink === undefined) {
      return invalidConfig('`wechat.universalLink` is required on iOS');
    }
  }

  if (dingtalk !== undefined && dingtalkAppId === undefined) {
    return invalidConfig('`dingtalk.appId` is required');
  }

  if (
    wechatUniversalLink !== undefined &&
    !isValidUniversalLink(wechatUniversalLink)
  ) {
    return invalidConfig(
      '`wechat.universalLink` must be an absolute HTTPS URL with a host'
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
