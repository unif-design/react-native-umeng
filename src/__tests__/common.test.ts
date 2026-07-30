/// <reference types="jest" />

const mockNativeUmengCommon = {
  initialize: jest.fn<Promise<void>, [object]>(),
  isInited: jest.fn<Promise<unknown>, []>(),
};

jest.mock('../NativeUmengCommon', () => ({
  __esModule: true,
  default: mockNativeUmengCommon,
}));

const CONFIG = {
  appkey: ' YOUR_APPKEY ',
  channel: ' App Store ',
  wechatAppId: ' wxXXX ',
  wechatAppSecret: ' secretXXX ',
  wechatUniversalLink: ' https://example.com/umeng/ ',
  dingtalkAppId: ' dingoaXXX ',
};

const NORMALIZED_CONFIG = {
  appkey: 'YOUR_APPKEY',
  channel: 'App Store',
  wechatAppId: 'wxXXX',
  wechatAppSecret: 'secretXXX',
  wechatUniversalLink: 'https://example.com/umeng/',
  dingtalkAppId: 'dingoaXXX',
};

type CommonModule = typeof import('../common');

async function loadCommon(): Promise<CommonModule> {
  jest.resetModules();
  let Common: CommonModule | undefined;

  await jest.isolateModulesAsync(async () => {
    Common = await import('../common');
  });

  if (Common === undefined) {
    throw new Error('Common module did not load');
  }
  return Common;
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('Common', () => {
  beforeEach(() => {
    mockNativeUmengCommon.initialize.mockReset();
    mockNativeUmengCommon.initialize.mockResolvedValue(undefined);
    mockNativeUmengCommon.isInited.mockReset();
    mockNativeUmengCommon.isInited.mockResolvedValue(false);
  });

  it('keeps preInit JS-only and shares one in-flight native initialization', async () => {
    const Common = await loadCommon();
    const nativeInitialization = deferred();
    mockNativeUmengCommon.initialize.mockReturnValueOnce(
      nativeInitialization.promise
    );

    await Common.preInit(CONFIG);
    expect(mockNativeUmengCommon.initialize).not.toHaveBeenCalled();

    const first = Common.init();
    const second = Common.init();

    expect(first).toBe(second);
    expect(mockNativeUmengCommon.initialize).toHaveBeenCalledTimes(1);
    expect(mockNativeUmengCommon.initialize).toHaveBeenCalledWith(
      NORMALIZED_CONFIG
    );

    nativeInitialization.resolve();
    await first;
  });

  it('rejects init before a successful preInit', async () => {
    const Common = await loadCommon();

    await expect(Common.init()).rejects.toMatchObject({
      code: 'E_NOT_INITIALIZED',
    });
    expect(mockNativeUmengCommon.initialize).not.toHaveBeenCalled();
  });

  it('atomically replaces config before native initialization starts', async () => {
    const Common = await loadCommon();

    await Common.preInit({ appkey: 'first' });
    await Common.preInit({ channel: ' release ', appkey: ' second ' });
    await Common.init();

    expect(mockNativeUmengCommon.initialize).toHaveBeenCalledWith({
      appkey: 'second',
      channel: 'release',
    });
  });

  it('keeps the previous snapshot when replacement validation fails', async () => {
    const Common = await loadCommon();

    await Common.preInit({ appkey: 'stable-appkey', channel: 'stable' });
    await expect(
      Common.preInit({ appkey: ' ', channel: 'invalid' })
    ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    await Common.init();

    expect(mockNativeUmengCommon.initialize).toHaveBeenCalledWith({
      appkey: 'stable-appkey',
      channel: 'stable',
    });
  });

  it('treats the same normalized config as idempotent after init starts', async () => {
    const Common = await loadCommon();
    const nativeInitialization = deferred();
    mockNativeUmengCommon.initialize.mockReturnValueOnce(
      nativeInitialization.promise
    );

    await Common.preInit(CONFIG);
    const initialization = Common.init();
    await expect(
      Common.preInit({
        ...NORMALIZED_CONFIG,
        appkey: ` ${NORMALIZED_CONFIG.appkey} `,
      })
    ).resolves.toBeUndefined();
    expect(mockNativeUmengCommon.initialize).toHaveBeenCalledTimes(1);

    nativeInitialization.resolve();
    await initialization;
  });

  it('rejects a different config after native initialization starts', async () => {
    const Common = await loadCommon();
    const nativeInitialization = deferred();
    mockNativeUmengCommon.initialize.mockReturnValueOnce(
      nativeInitialization.promise
    );

    await Common.preInit(CONFIG);
    const initialization = Common.init();

    await expect(
      Common.preInit({ ...CONFIG, appkey: 'another-appkey' })
    ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });

    nativeInitialization.resolve();
    await initialization;
  });

  it('normalizes native errors without exposing restart metadata publicly', async () => {
    const Common = await loadCommon();
    const nativeError = Object.assign(new Error('vendor partially started'), {
      restartRequired: true,
    });
    mockNativeUmengCommon.initialize.mockRejectedValueOnce(nativeError);

    await Common.preInit(CONFIG);
    const error = await Common.init().catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      code: 'E_UNKNOWN',
      message: 'vendor partially started',
      nativeError,
    });
    expect(error).not.toHaveProperty('restartRequired');
  });

  it('keeps config locked after failure and retries with the same config', async () => {
    const Common = await loadCommon();
    mockNativeUmengCommon.initialize.mockRejectedValueOnce(
      new Error('temporary failure')
    );

    await Common.preInit(CONFIG);
    await expect(Common.init()).rejects.toMatchObject({ code: 'E_UNKNOWN' });
    await expect(
      Common.preInit({ ...CONFIG, appkey: 'another-appkey' })
    ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    await expect(Common.preInit(CONFIG)).resolves.toBeUndefined();
    await Common.init();

    expect(mockNativeUmengCommon.initialize).toHaveBeenCalledTimes(2);
    expect(mockNativeUmengCommon.initialize).toHaveBeenNthCalledWith(
      2,
      NORMALIZED_CONFIG
    );
  });

  it('does not enter native again after successful initialization', async () => {
    const Common = await loadCommon();

    await Common.preInit(CONFIG);
    await Common.init();
    await Common.init();

    expect(mockNativeUmengCommon.initialize).toHaveBeenCalledTimes(1);
  });

  it('returns a boolean initialization state from native', async () => {
    const Common = await loadCommon();
    mockNativeUmengCommon.isInited.mockResolvedValueOnce(true);

    await expect(Common.isInited()).resolves.toBe(true);
  });

  it('normalizes isInited native rejections', async () => {
    const Common = await loadCommon();
    const nativeError = new Error('query failed');
    mockNativeUmengCommon.isInited.mockRejectedValueOnce(nativeError);

    await expect(Common.isInited()).rejects.toMatchObject({
      code: 'E_UNKNOWN',
      message: 'query failed',
      nativeError,
    });
  });

  it('rejects a non-boolean native initialization state', async () => {
    const Common = await loadCommon();
    mockNativeUmengCommon.isInited.mockResolvedValueOnce('true');

    await expect(Common.isInited()).rejects.toMatchObject({
      code: 'E_UNKNOWN',
      message: 'Failed to query Umeng initialization state',
    });
  });
});
