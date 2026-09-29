import {
  normalizeInitConfig,
  toNativeInitConfig,
} from '../internal/initConfig';
it.each([
  {},
  null,
  { appKey: '' },
  { appKey: 'app', wechat: {} },
  { appKey: 'app', wechat: { appId: 'wx' } },
  { appKey: 'app', dingtalk: {} },
  {
    appKey: 'app',
    wechat: {
      appId: 'wx',
      appSecret: 'secret',
      universalLink: 'http://example.com',
    },
  },
])('rejects incomplete or invalid config before native: %p', (input) => {
  expect(() => normalizeInitConfig(input, 'ios')).toThrow(
    expect.objectContaining({ reason: 'invalid_input' })
  );
});
it('requires the real HTTPS universal link on iOS only', () => {
  const config = {
    appKey: ' app ',
    wechat: { appId: ' wx ', appSecret: ' secret ' },
  };
  expect(() => normalizeInitConfig(config, 'ios')).toThrow(
    expect.objectContaining({ reason: 'invalid_input' })
  );
  expect(toNativeInitConfig(normalizeInitConfig(config, 'android'))).toEqual({
    appkey: 'app',
    wechatAppId: 'wx',
    wechatAppSecret: 'secret',
  });
});
it('allows analytics-only config and snapshots nested platform values', () => {
  expect(
    toNativeInitConfig(normalizeInitConfig({ appKey: 'app' }, 'ios'))
  ).toEqual({ appkey: 'app' });
  const input = { appKey: 'app', dingtalk: { appId: 'ding' } };
  const config = normalizeInitConfig(input, 'ios');
  input.dingtalk.appId = 'changed';
  expect(toNativeInitConfig(config)).toEqual({
    appkey: 'app',
    dingtalkAppId: 'ding',
  });
  expect(Object.isFrozen(config)).toBe(true);
});
