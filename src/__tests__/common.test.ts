import { deferred } from './fixtures/deferred';

const mockNative = {
  initialize: jest.fn<Promise<void>, [object]>(),
  isInited: jest.fn<Promise<unknown>, []>(),
};
jest.mock('../NativeUmengCommon', () => ({
  __esModule: true,
  default: mockNative,
}));

async function loadCommon() {
  jest.resetModules();
  return import('../common');
}

beforeEach(() => {
  mockNative.initialize.mockReset().mockResolvedValue(undefined);
  mockNative.isInited.mockReset().mockResolvedValue(false);
});

it('takes an immutable configuration and coalesces concurrent initialization', async () => {
  const api = await loadCommon();
  expect(api.initializeUmeng).toEqual(expect.any(Function));
  const pending = deferred<void>();
  mockNative.initialize.mockReturnValueOnce(pending.promise);
  const config = {
    appKey: 'app',
    wechat: {
      appId: 'wx',
      appSecret: 'secret',
      universalLink: 'https://example.com/',
    },
  };
  const first = api.initializeUmeng(config);
  expect(api.initializeUmeng({ ...config, wechat: { ...config.wechat } })).toBe(
    first
  );
  config.wechat.appId = 'changed';
  expect(mockNative.initialize).toHaveBeenCalledWith({
    appkey: 'app',
    wechatAppId: 'wx',
    wechatAppSecret: 'secret',
    wechatUniversalLink: 'https://example.com/',
  });
  await expect(api.initializeUmeng(config)).rejects.toMatchObject({
    reason: 'configuration_locked',
  });
  pending.resolve();
  await first;
  await api.initializeUmeng({
    appKey: 'app',
    wechat: {
      appId: 'wx',
      appSecret: 'secret',
      universalLink: 'https://example.com/',
    },
  });
  expect(mockNative.initialize).toHaveBeenCalledTimes(1);
});

it('keeps configuration locked after failure and retries only on an explicit call', async () => {
  const api = await loadCommon();
  expect(api.initializeUmeng).toEqual(expect.any(Function));
  mockNative.initialize.mockRejectedValueOnce({
    code: 'VENDOR_42',
    message: 'registration failed',
  });
  await expect(api.initializeUmeng({ appKey: 'app' })).rejects.toMatchObject({
    reason: 'sdk_failed',
    sourceCode: 'VENDOR_42',
  });
  expect(mockNative.initialize).toHaveBeenCalledTimes(1);
  await expect(api.initializeUmeng({ appKey: 'other' })).rejects.toMatchObject({
    reason: 'configuration_locked',
  });
  await api.initializeUmeng({ appKey: 'app' });
  expect(mockNative.initialize).toHaveBeenCalledTimes(2);
});

it('reads native readiness and preserves query errors and invalid responses', async () => {
  const api = await loadCommon();
  expect(api.isUmengInitialized).toEqual(expect.any(Function));
  mockNative.isInited
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce('true')
    .mockRejectedValueOnce(new Error('query failed'));
  await expect(api.isUmengInitialized()).resolves.toBe(true);
  await expect(api.isUmengInitialized()).rejects.toMatchObject({
    reason: 'invalid_response',
  });
  await expect(api.isUmengInitialized()).rejects.toMatchObject({
    reason: 'sdk_failed',
  });
  expect(mockNative.initialize).not.toHaveBeenCalled();
});

it('does not lock configuration or invoke native for invalid input', async () => {
  const api = await loadCommon();
  expect(api.initializeUmeng).toEqual(expect.any(Function));
  await expect(api.initializeUmeng({ appKey: '' })).rejects.toMatchObject({
    reason: 'invalid_input',
  });
  expect(mockNative.initialize).not.toHaveBeenCalled();
  await api.initializeUmeng({ appKey: 'app' });
});

describe('universal links with the React Native runtime', () => {
  const originalURL = globalThis.URL;
  beforeEach(() => {
    globalThis.URL = jest.requireActual('react-native/Libraries/Blob/URL').URL;
  });
  afterEach(() => {
    globalThis.URL = originalURL;
  });

  it.each([
    'https://bad host/universal/',
    'https://example.com:notaport/universal/',
  ])(
    'rejects an invalid authority without locking config: %s',
    async (universalLink) => {
      const api = await loadCommon();
      await expect(
        api.initializeUmeng({
          appKey: 'app',
          wechat: { appId: 'wx', appSecret: 'secret', universalLink },
        })
      ).rejects.toMatchObject({ reason: 'invalid_input' });
      expect(mockNative.initialize).not.toHaveBeenCalled();
      const validLink = 'HTTPS://example.com:8443/universal/';
      await api.initializeUmeng({
        appKey: 'app',
        wechat: {
          appId: 'wx',
          appSecret: 'secret',
          universalLink: validLink,
        },
      });
      expect(mockNative.initialize).toHaveBeenCalledWith({
        appkey: 'app',
        wechatAppId: 'wx',
        wechatAppSecret: 'secret',
        wechatUniversalLink: validLink,
      });
    }
  );
});
