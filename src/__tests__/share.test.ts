import { deferred } from './fixtures/deferred';
const mockCommon = {
  getConfiguredShareTargets: jest.fn(),
  isInited: jest.fn(),
};
const mockNative = {
  shareText: jest.fn(),
  shareImage: jest.fn(),
  shareLink: jest.fn(),
  isInstalled: jest.fn(),
};
jest.mock('../NativeUmengCommon', () => ({
  __esModule: true,
  default: mockCommon,
}));
jest.mock('../NativeUmengShare', () => ({
  __esModule: true,
  default: mockNative,
}));
const api: typeof import('../share') = require('../share');

beforeEach(() => {
  jest.clearAllMocks();
  mockCommon.getConfiguredShareTargets.mockResolvedValue([
    'wechat_session',
    'dingtalk',
  ]);
  mockCommon.isInited.mockResolvedValue(true);
  mockNative.isInstalled.mockResolvedValue(true);
  mockNative.shareText.mockResolvedValue({
    code: 'success',
    platform: 'wechat_session',
  });
  mockNative.shareImage.mockResolvedValue({
    code: 'success',
    platform: 'wechat_session',
  });
  mockNative.shareLink.mockResolvedValue({
    code: 'success',
    platform: 'wechat_session',
  });
});

it('reads only native configured targets, including analytics-only initialization', async () => {
  expect(api.getShareTargets).toEqual(expect.any(Function));
  mockCommon.getConfiguredShareTargets
    .mockResolvedValueOnce(['dingtalk'])
    .mockResolvedValueOnce([]);
  mockNative.isInstalled.mockResolvedValueOnce(false);
  await expect(api.getShareTargets()).resolves.toEqual([
    { target: 'dingtalk', label: '钉钉', installed: false },
  ]);
  await expect(api.getShareTargets()).resolves.toEqual([]);
  expect(mockNative.isInstalled).toHaveBeenCalledTimes(1);
});

it('rejects holes in a native target response before querying installation state', async () => {
  const targets = new Array(2);
  targets[1] = 'wechat_session';
  mockCommon.getConfiguredShareTargets.mockResolvedValueOnce(targets);
  await expect(api.getShareTargets()).rejects.toMatchObject({
    reason: 'invalid_response',
  });
  expect(mockNative.isInstalled).not.toHaveBeenCalled();
});

describe('HTTP URLs with the React Native runtime', () => {
  const originalURL = globalThis.URL;
  beforeEach(() => {
    globalThis.URL = jest.requireActual('react-native/Libraries/Blob/URL').URL;
  });
  afterEach(() => {
    globalThis.URL = originalURL;
  });

  it.each([
    'https://bad host/image.png',
    'https://bad%20host/image.png',
    'https://example.com:notaport/image.png',
    'https://example.com:65536/image.png',
    'https://[broken]/image.png',
  ])('rejects invalid authorities before invoking native: %s', async (url) => {
    for (const content of [
      { type: 'image' as const, imageUrl: url },
      { type: 'link' as const, title: 'Title', url },
      {
        type: 'image' as const,
        imageUrl: 'https://example.com/image.png',
        thumbnailUrl: url,
      },
    ]) {
      await expect(
        api.share({ target: 'wechat_session', content })
      ).resolves.toMatchObject({
        status: 'failed',
        error: { reason: 'invalid_input' },
      });
    }
    expect(mockCommon.getConfiguredShareTargets).not.toHaveBeenCalled();
    expect(mockNative.shareImage).not.toHaveBeenCalled();
    expect(mockNative.shareLink).not.toHaveBeenCalled();
  });

  it.each([
    'HTTPS://example.com:8443/image.png?signature=a%2Bb#image',
    'http://127.0.0.1:8080/image.png',
    'https://[2001:db8::1]:8443/image.png',
    'https://[::ffff:192.0.2.1]/image.png',
    'https://例子.中国/image.png',
  ])('preserves valid URL input for native: %s', async (imageUrl) => {
    await expect(
      api.share({
        target: 'wechat_session',
        content: { type: 'image', imageUrl },
      })
    ).resolves.toEqual({ status: 'success', target: 'wechat_session' });
    expect(mockNative.shareImage).toHaveBeenCalledWith(
      'wechat_session',
      imageUrl,
      undefined
    );
  });
});

it('preserves text, image, link and optional empty description in native adaptation', async () => {
  expect(api.share).toEqual(expect.any(Function));
  await expect(
    api.share({
      target: 'wechat_session',
      content: { type: 'text', text: ' hello ' },
    })
  ).resolves.toEqual({ status: 'success', target: 'wechat_session' });
  expect(mockNative.shareText).toHaveBeenCalledWith(
    'wechat_session',
    ' hello '
  );
  await api.share({
    target: 'wechat_session',
    content: {
      type: 'image',
      imageUrl: 'HTTPS://example.com/image.png',
      thumbnailUrl: 'https://example.com/thumb.png',
    },
  });
  expect(mockNative.shareImage).toHaveBeenCalledWith(
    'wechat_session',
    'HTTPS://example.com/image.png',
    'https://example.com/thumb.png'
  );
  await api.share({
    target: 'wechat_session',
    content: {
      type: 'link',
      title: ' Title ',
      url: 'https://example.com/',
      description: '',
    },
  });
  expect(mockNative.shareLink).toHaveBeenCalledWith(
    'wechat_session',
    ' Title ',
    'https://example.com/',
    '',
    undefined
  );
});

it('returns cancellation and failure as outcomes without retrying', async () => {
  expect(api.share).toEqual(expect.any(Function));
  mockNative.shareText
    .mockRejectedValueOnce({ code: 'E_USER_CANCEL' })
    .mockRejectedValueOnce({ code: 'E_SHARE_FAILED', message: 'SDK failed' });
  const request = {
    target: 'wechat_session',
    content: { type: 'text', text: 'hello' },
  } as const;
  await expect(api.share(request)).resolves.toEqual({
    status: 'cancelled',
    target: 'wechat_session',
  });
  await expect(api.share(request)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'sdk_failed', sourceCode: 'E_SHARE_FAILED' },
  });
  expect(mockNative.shareText).toHaveBeenCalledTimes(2);
});

it.each([
  null,
  {},
  { code: 'success', platform: 'dingtalk' },
  { code: 'unexpected', platform: 'wechat_session' },
])('rejects malformed or mismatched SDK receipts: %p', async (receipt) => {
  expect(api.share).toEqual(expect.any(Function));
  mockNative.shareText.mockResolvedValueOnce(receipt);
  await expect(
    api.share({
      target: 'wechat_session',
      content: { type: 'text', text: 'hello' },
    })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_response' },
  });
});

it('does not call native share for invalid content, an unconfigured target or missing app', async () => {
  expect(api.share).toEqual(expect.any(Function));
  await expect(
    api.share({
      target: 'wechat_session',
      content: { type: 'image', imageUrl: 'file:///a.png' },
    })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  mockCommon.getConfiguredShareTargets.mockResolvedValueOnce(['dingtalk']);
  await expect(
    api.share({
      target: 'wechat_session',
      content: { type: 'text', text: 'hello' },
    })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'not_initialized' },
  });
  mockNative.isInstalled.mockResolvedValueOnce(false);
  await expect(
    api.share({
      target: 'wechat_session',
      content: { type: 'text', text: 'hello' },
    })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'not_installed' },
  });
  expect(mockNative.shareText).not.toHaveBeenCalled();
  expect(mockNative.shareImage).not.toHaveBeenCalled();
});

it('holds one share channel and the original content snapshot until the native receipt', async () => {
  expect(api.share).toEqual(expect.any(Function));
  const pending = deferred<unknown>();
  mockNative.shareText.mockReturnValueOnce(pending.promise);
  const request = {
    target: 'wechat_session' as const,
    content: { type: 'text' as const, text: 'original' },
  };
  const first = api.share(request);
  request.content.text = 'changed';
  await expect(api.share(request)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'busy' },
  });
  pending.resolve({ code: 'success', platform: 'wechat_session' });
  await expect(first).resolves.toEqual({
    status: 'success',
    target: 'wechat_session',
  });
  expect(mockNative.shareText).toHaveBeenCalledWith(
    'wechat_session',
    'original'
  );
});

it.each([null, ['dingtalk', 'dingtalk']])(
  'rejects malformed configured targets: %p',
  async (targets) => {
    mockCommon.getConfiguredShareTargets.mockResolvedValueOnce(targets);
    await expect(api.getShareTargets()).rejects.toMatchObject({
      reason: 'invalid_response',
    });
    expect(mockNative.isInstalled).not.toHaveBeenCalled();
  }
);

it('rejects non-boolean installed state', async () => {
  mockNative.isInstalled.mockResolvedValueOnce('true');
  await expect(api.getShareTargets()).rejects.toMatchObject({
    reason: 'invalid_response',
  });
});

it.each([
  [
    { code: 'cancel', platform: 'wechat_session' },
    { status: 'cancelled', target: 'wechat_session' },
  ],
  [
    { code: 'failed', platform: 'wechat_session', message: 'SDK rejected' },
    {
      status: 'failed',
      target: 'wechat_session',
      error: { reason: 'sdk_failed', message: 'SDK rejected' },
    },
  ],
  [
    { code: 'failed', platform: 'wechat_session', message: ' ' },
    {
      status: 'failed',
      target: 'wechat_session',
      error: { reason: 'sdk_failed', message: 'Share failed' },
    },
  ],
  [
    { code: 'failed', platform: 'wechat_session' },
    {
      status: 'failed',
      target: 'wechat_session',
      error: { reason: 'sdk_failed', message: 'Share failed' },
    },
  ],
])('preserves the SDK receipt outcome %p', async (receipt, expected) => {
  mockNative.shareText.mockResolvedValueOnce(receipt);
  await expect(
    api.share({
      target: 'wechat_session',
      content: { type: 'text', text: 'hello' },
    })
  ).resolves.toEqual(expected);
});

it.each([12, [], { code: 'success', platform: 'wechat_session', message: 7 }])(
  'rejects a malformed SDK receipt %p',
  async (receipt) => {
    mockNative.shareText.mockResolvedValueOnce(receipt);
    await expect(
      api.share({
        target: 'wechat_session',
        content: { type: 'text', text: 'hello' },
      })
    ).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'invalid_response' },
    });
  }
);

it.each([
  null,
  [],
  { target: 'unknown' },
  { target: 'dingtalk', content: { type: 'other' } },
  {
    target: 'dingtalk',
    content: {
      type: 'link',
      title: 'title',
      url: 'https://example.com',
      description: 3,
    },
  },
])('rejects invalid share input before native: %p', async (input) => {
  await expect(api.share(input as never)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_input' },
  });
  expect(mockCommon.getConfiguredShareTargets).not.toHaveBeenCalled();
});

it('forwards link thumbnails and omitted descriptions', async () => {
  await api.share({
    target: 'wechat_session',
    content: {
      type: 'link',
      title: 'title',
      url: 'https://example.com',
      thumbnailUrl: 'https://example.com/thumb.png',
    },
  });
  expect(mockNative.shareLink).toHaveBeenCalledWith(
    'wechat_session',
    'title',
    'https://example.com',
    undefined,
    'https://example.com/thumb.png'
  );
});

it.each([null, 'SDK exception'])(
  'normalizes non-object SDK failures %p',
  async (error) => {
    mockNative.shareText.mockRejectedValueOnce(error);
    await expect(
      api.share({
        target: 'wechat_session',
        content: { type: 'text', text: 'hello' },
      })
    ).resolves.toMatchObject({
      status: 'failed',
      error: { reason: 'sdk_failed' },
    });
  }
);

it('preserves a cancellation raised by an input getter before a target is selected', async () => {
  const input = {
    get target(): 'dingtalk' {
      throw { code: 'E_USER_CANCEL' };
    },
    content: { type: 'text' as const, text: 'hello' },
  };
  await expect(api.share(input)).resolves.toEqual({ status: 'cancelled' });
});

it('preserves a missing native receipt as invalid_response and releases the share channel', async () => {
  mockNative.shareText.mockRejectedValueOnce({
    code: 'E_INVALID_RESPONSE',
    message: 'Returned without a share receipt',
  });
  const request = {
    target: 'wechat_session',
    content: { type: 'text', text: 'hello' },
  } as const;
  await expect(api.share(request)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'invalid_response', sourceCode: 'E_INVALID_RESPONSE' },
  });
  await expect(api.share(request)).resolves.toEqual({
    status: 'success',
    target: 'wechat_session',
  });
});
