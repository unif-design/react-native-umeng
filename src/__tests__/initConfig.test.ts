/// <reference types="jest" />
import {
  areInitConfigsEqual,
  normalizeInitConfig,
  toNativeInitConfig,
} from '../internal/initConfig';
import { UmengError } from '../types';

const validAndroidConfig = {
  appkey: ' android-appkey ',
  channel: ' default ',
  wechatAppId: ' wx-app-id ',
  wechatAppSecret: ' wx-secret ',
  dingtalkAppId: ' ding-app-id ',
};

const validIosConfig = {
  ...validAndroidConfig,
  wechatUniversalLink: ' https://example.com/umeng/ ',
};

function expectInvalidConfig(config: unknown, os: 'android' | 'ios'): void {
  expect(() => normalizeInitConfig(config, os)).toThrow(UmengError);
  expect(() => normalizeInitConfig(config, os)).toThrow(
    expect.objectContaining({ code: 'E_INVALID_OPTIONS' })
  );
}

describe('normalizeInitConfig', () => {
  it('trims strings into a frozen Android snapshot', () => {
    const config = normalizeInitConfig(validAndroidConfig, 'android');

    expect(config).toEqual({
      appkey: 'android-appkey',
      channel: 'default',
      wechatAppId: 'wx-app-id',
      wechatAppSecret: 'wx-secret',
      wechatUniversalLink: undefined,
      dingtalkAppId: 'ding-app-id',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([null, [], 1, 'config'])(
    'rejects a non-object config: %p',
    (config) => {
      expectInvalidConfig(config, 'android');
    }
  );

  it.each([
    { appkey: ' ' },
    { appkey: 1 },
    { appkey: 'appkey', channel: 1 },
    { appkey: 'appkey', dingtalkAppId: false },
  ])('rejects empty or non-string fields: %p', (config) => {
    expectInvalidConfig(config, 'android');
  });

  it('requires the complete Android WeChat pair', () => {
    expectInvalidConfig({ appkey: 'appkey', wechatAppId: 'wx-id' }, 'android');
    expectInvalidConfig(
      { appkey: 'appkey', wechatAppSecret: 'wx-secret' },
      'android'
    );
    expect(
      normalizeInitConfig(
        {
          appkey: 'appkey',
          wechatAppId: 'wx-id',
          wechatAppSecret: 'wx-secret',
        },
        'android'
      )
    ).toMatchObject({ wechatAppId: 'wx-id', wechatAppSecret: 'wx-secret' });
  });

  it('requires the complete iOS WeChat triple', () => {
    expectInvalidConfig(
      { appkey: 'appkey', wechatAppId: 'wx-id', wechatAppSecret: 'wx-secret' },
      'ios'
    );
    expect(normalizeInitConfig(validIosConfig, 'ios')).toMatchObject({
      wechatAppId: 'wx-app-id',
      wechatAppSecret: 'wx-secret',
      wechatUniversalLink: 'https://example.com/umeng/',
    });
  });

  it.each([
    'http://example.com/umeng',
    'https://',
    'https:/example.com/umeng',
    '/umeng',
  ])(
    'rejects a Universal Link that is not an absolute HTTPS URL: %s',
    (link) => {
      expectInvalidConfig(
        {
          appkey: 'appkey',
          wechatAppId: 'wx-id',
          wechatAppSecret: 'wx-secret',
          wechatUniversalLink: link,
        },
        'ios'
      );
    }
  );

  it('rejects partial WeChat input without exposing a partial normalized result', () => {
    const partialConfig = {
      appkey: 'appkey',
      wechatUniversalLink: 'https://example.com',
    };

    expectInvalidConfig(partialConfig, 'android');
    expect(partialConfig).toEqual({
      appkey: 'appkey',
      wechatUniversalLink: 'https://example.com',
    });
  });
});

describe('areInitConfigsEqual', () => {
  it('compares fixed fields independently of source key order', () => {
    const left = normalizeInitConfig(
      { appkey: 'appkey', channel: 'channel', dingtalkAppId: 'ding' },
      'android'
    );
    const right = normalizeInitConfig(
      { dingtalkAppId: 'ding', channel: 'channel', appkey: 'appkey' },
      'android'
    );
    const changed = normalizeInitConfig(
      { appkey: 'appkey', channel: 'other', dingtalkAppId: 'ding' },
      'android'
    );

    expect(areInitConfigsEqual(left, right)).toBe(true);
    expect(areInitConfigsEqual(left, changed)).toBe(false);
  });
});

describe('toNativeInitConfig', () => {
  it('omits undefined values from the native payload', () => {
    const nativeConfig = toNativeInitConfig(
      normalizeInitConfig({ appkey: 'appkey', channel: 'channel' }, 'android')
    );

    expect(nativeConfig).toEqual({ appkey: 'appkey', channel: 'channel' });
    expect(nativeConfig).not.toHaveProperty('wechatAppId');
    expect(nativeConfig).not.toHaveProperty('wechatAppSecret');
    expect(nativeConfig).not.toHaveProperty('wechatUniversalLink');
    expect(nativeConfig).not.toHaveProperty('dingtalkAppId');
  });
});
