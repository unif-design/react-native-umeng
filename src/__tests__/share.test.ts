/// <reference types="jest" />

jest.mock('../NativeUmengShare', () => ({
  __esModule: true,
  default: {
    shareText: jest.fn(),
    shareImage: jest.fn(),
    shareLink: jest.fn(),
    isInstalled: jest.fn(),
  },
}));
jest.mock('../ShareSheet/ShareSheetController', () => ({
  shareSheetController: { show: jest.fn() },
}));

import NativeUmengShare from '../NativeUmengShare';
import { shareSheetController } from '../ShareSheet/ShareSheetController';
import * as Share from '../share';
import { Platform } from '../types';

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('Share', () => {
  const mockedShareText = NativeUmengShare.shareText as jest.Mock;
  const mockedShareImage = NativeUmengShare.shareImage as jest.Mock;
  const mockedShareLink = NativeUmengShare.shareLink as jest.Mock;
  const mockedIsInstalled = NativeUmengShare.isInstalled as jest.Mock;

  beforeEach(() => {
    mockedShareText.mockReset();
    mockedShareImage.mockReset();
    mockedShareLink.mockReset();
    mockedIsInstalled.mockReset();
    (shareSheetController.show as jest.Mock).mockReset();
    (shareSheetController.show as jest.Mock).mockResolvedValue({
      code: 'success',
      platform: Platform.WECHAT_SESSION,
    });
  });

  describe('shareText', () => {
    it('forwards platform + text to native and returns ShareResult', async () => {
      mockedShareText.mockResolvedValue({
        code: 'success',
        message: 'ok',
        platform: 'wechat_session',
      });
      const r = await Share.shareText({
        platform: Platform.WECHAT_SESSION,
        text: 'hi',
      });
      expect(NativeUmengShare.shareText).toHaveBeenCalledWith(
        'wechat_session',
        'hi'
      );
      expect(r).toEqual({
        code: 'success',
        message: 'ok',
        platform: Platform.WECHAT_SESSION,
      });
    });

    it('rejects E_INVALID_OPTIONS when text is empty', async () => {
      await expect(
        Share.shareText({ platform: Platform.WECHAT_SESSION, text: '' })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    });

    it.each([null, undefined, [], 'options'])(
      'rejects non-object options without reaching native: %#',
      async (options) => {
        await expect(Share.shareText(options as never)).rejects.toMatchObject({
          code: 'E_INVALID_OPTIONS',
        });
        expect(mockedShareText).not.toHaveBeenCalled();
      }
    );

    it.each(['', '   ', null, 42])(
      'rejects invalid text without reaching native: %#',
      async (text) => {
        await expect(
          Share.shareText({
            platform: Platform.WECHAT_SESSION,
            text,
          } as never)
        ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
        expect(mockedShareText).not.toHaveBeenCalled();
      }
    );

    it('rejects E_PLATFORM_NOT_SUPPORTED for unknown platform', async () => {
      await expect(
        Share.shareText({ platform: 'unknown' as Platform, text: 'hi' })
      ).rejects.toMatchObject({ code: 'E_PLATFORM_NOT_SUPPORTED' });
    });

    it('maps native cancel to UmengError E_USER_CANCEL', async () => {
      mockedShareText.mockResolvedValue({
        code: 'cancel',
        message: 'user cancelled',
        platform: 'wechat_session',
      });
      await expect(
        Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' })
      ).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
    });

    it('maps native failed to UmengError E_SHARE_FAILED', async () => {
      mockedShareText.mockResolvedValue({
        code: 'failed',
        message: 'something broke',
        platform: 'wechat_session',
      });
      await expect(
        Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' })
      ).rejects.toMatchObject({
        code: 'E_SHARE_FAILED',
        message: 'something broke',
      });
    });

    it.each([
      [null, 'E_UNKNOWN'],
      [{}, 'E_UNKNOWN'],
      [{ code: 'mystery', platform: 'wechat_session' }, 'E_UNKNOWN'],
      [{ code: 'success', platform: 'dingtalk' }, 'E_UNKNOWN'],
      [{ code: 'success' }, 'E_UNKNOWN'],
      [
        { code: 'success', platform: 'wechat_session', message: 42 },
        'E_UNKNOWN',
      ],
    ])('rejects malformed native result %#', async (nativeResult, code) => {
      mockedShareText.mockResolvedValueOnce(nativeResult);

      await expect(
        Share.shareText({
          platform: Platform.WECHAT_SESSION,
          text: 'hi',
        })
      ).rejects.toMatchObject({ code });
    });

    it('preserves a whitelisted code from an RN-style native Error', async () => {
      mockedShareText.mockRejectedValueOnce(
        Object.assign(new Error('not initialized'), {
          code: 'E_NOT_INITIALIZED',
        })
      );

      await expect(
        Share.shareText({
          platform: Platform.WECHAT_SESSION,
          text: 'hi',
        })
      ).rejects.toMatchObject({
        code: 'E_NOT_INITIALIZED',
        message: 'not initialized',
      });
    });

    it('uses E_SHARE_FAILED for an unknown RN-style native error code', async () => {
      mockedShareText.mockRejectedValueOnce(
        Object.assign(new Error('vendor failure'), { code: 'VENDOR_ERROR' })
      );

      await expect(
        Share.shareText({
          platform: Platform.WECHAT_SESSION,
          text: 'hi',
        })
      ).rejects.toMatchObject({
        code: 'E_SHARE_FAILED',
        message: 'vendor failure',
      });
    });
  });

  describe('shareImage', () => {
    it('forwards optional thumb', async () => {
      mockedShareImage.mockResolvedValue({
        code: 'success',
        platform: 'dingtalk',
      });
      await Share.shareImage({
        platform: Platform.DINGTALK,
        image: 'https://x/a.png',
        thumb: 'https://x/t.png',
      });
      expect(NativeUmengShare.shareImage).toHaveBeenCalledWith(
        'dingtalk',
        'https://x/a.png',
        'https://x/t.png'
      );
    });

    it('rejects E_INVALID_OPTIONS when image is empty', async () => {
      await expect(
        Share.shareImage({ platform: Platform.WECHAT_SESSION, image: '' })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    });

    it.each([
      ['image', '/relative.png'],
      ['image', 'file:///tmp/a.png'],
      ['image', 'https://'],
      ['thumb', '/relative-thumb.png'],
      ['thumb', 'ftp://example.com/thumb.png'],
    ])('rejects a non-http(s) absolute %s URL', async (field, value) => {
      await expect(
        Share.shareImage({
          platform: Platform.WECHAT_SESSION,
          image: field === 'image' ? value : 'https://example.com/image.png',
          thumb: field === 'thumb' ? value : undefined,
        })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
      expect(mockedShareImage).not.toHaveBeenCalled();
    });
  });

  describe('shareLink', () => {
    it('forwards all fields', async () => {
      mockedShareLink.mockResolvedValue({
        code: 'success',
        platform: 'wechat_session',
      });
      await Share.shareLink({
        platform: Platform.WECHAT_SESSION,
        title: 'T',
        url: 'https://x',
        description: 'D',
        thumb: 'https://t',
      });
      expect(NativeUmengShare.shareLink).toHaveBeenCalledWith(
        'wechat_session',
        'T',
        'https://x',
        'D',
        'https://t'
      );
    });

    it('rejects when title or url missing', async () => {
      await expect(
        Share.shareLink({
          platform: Platform.WECHAT_SESSION,
          title: '',
          url: 'https://x',
        })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });

      await expect(
        Share.shareLink({
          platform: Platform.WECHAT_SESSION,
          title: 'T',
          url: '',
        })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
    });

    it.each([
      '/relative',
      'mailto:user@example.com',
      'https://',
      'ftp://example.com/file',
    ])('rejects a non-http(s) absolute link URL: %s', async (url) => {
      await expect(
        Share.shareLink({
          platform: Platform.WECHAT_SESSION,
          title: 'T',
          url,
        })
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
      expect(mockedShareLink).not.toHaveBeenCalled();
    });

    it.each([
      { title: '   ', url: 'https://example.com' },
      { title: 'T', url: '   ' },
    ])(
      'rejects required strings that are blank after trim: %#',
      async (input) => {
        await expect(
          Share.shareLink({
            platform: Platform.WECHAT_SESSION,
            ...input,
          })
        ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
        expect(mockedShareLink).not.toHaveBeenCalled();
      }
    );
  });

  describe('direct share platform snapshot', () => {
    type MutablePlatformOptions = { platform: Platform };
    type StartedShare = {
      options: MutablePlatformOptions;
      result: Promise<unknown>;
    };
    type StartShare = (nativePromise: Promise<unknown>) => StartedShare;

    const directShareCases: ReadonlyArray<
      readonly [name: string, startShare: StartShare]
    > = [
      [
        'shareText',
        (nativePromise) => {
          mockedShareText.mockReturnValueOnce(nativePromise);
          const options = {
            platform: Platform.WECHAT_SESSION,
            text: 'hi',
          };
          return { options, result: Share.shareText(options) };
        },
      ],
      [
        'shareImage',
        (nativePromise) => {
          mockedShareImage.mockReturnValueOnce(nativePromise);
          const options = {
            platform: Platform.WECHAT_SESSION,
            image: 'https://example.com/image.png',
          };
          return { options, result: Share.shareImage(options) };
        },
      ],
      [
        'shareLink',
        (nativePromise) => {
          mockedShareLink.mockReturnValueOnce(nativePromise);
          const options = {
            platform: Platform.WECHAT_SESSION,
            title: 'Title',
            url: 'https://example.com',
          };
          return { options, result: Share.shareLink(options) };
        },
      ],
    ];

    it.each(directShareCases)(
      '%s resolves a correct response against the originally requested platform',
      async (_name, startShare) => {
        const native = createDeferred<unknown>();
        const { options, result } = startShare(native.promise);

        options.platform = Platform.DINGTALK;
        native.resolve({
          code: 'success',
          platform: Platform.WECHAT_SESSION,
        });

        await expect(result).resolves.toEqual({
          code: 'success',
          platform: Platform.WECHAT_SESSION,
        });
      }
    );

    it.each(directShareCases)(
      '%s rejects a response matching only a mutated options platform',
      async (_name, startShare) => {
        const native = createDeferred<unknown>();
        const { options, result } = startShare(native.promise);

        options.platform = Platform.DINGTALK;
        native.resolve({
          code: 'success',
          platform: Platform.DINGTALK,
        });

        await expect(result).rejects.toMatchObject({ code: 'E_UNKNOWN' });
      }
    );
  });

  describe('isInstalled', () => {
    it('returns boolean from native', async () => {
      mockedIsInstalled.mockResolvedValue(true);
      await expect(Share.isInstalled(Platform.WECHAT_SESSION)).resolves.toBe(
        true
      );
    });

    it('rejects an unknown platform without reaching native', async () => {
      await expect(
        Share.isInstalled('unknown' as Platform)
      ).rejects.toMatchObject({ code: 'E_PLATFORM_NOT_SUPPORTED' });
      expect(mockedIsInstalled).not.toHaveBeenCalled();
    });

    it('rejects a malformed native boolean result', async () => {
      mockedIsInstalled.mockResolvedValueOnce('true');

      await expect(
        Share.isInstalled(Platform.WECHAT_SESSION)
      ).rejects.toMatchObject({ code: 'E_UNKNOWN' });
    });
  });

  describe('listPlatforms', () => {
    it('returns SUPPORTED_PLATFORMS with installed/displayName', async () => {
      mockedIsInstalled.mockImplementation((p: string) =>
        Promise.resolve(p === 'wechat_session')
      );
      const list = await Share.listPlatforms();
      expect(list).toEqual([
        {
          platform: Platform.WECHAT_SESSION,
          installed: true,
          displayName: '微信',
        },
        { platform: Platform.DINGTALK, installed: false, displayName: '钉钉' },
      ]);
    });

    it('propagates a whitelisted native error code', async () => {
      mockedIsInstalled.mockRejectedValueOnce(
        Object.assign(new Error('initialize first'), {
          code: 'E_NOT_INITIALIZED',
        })
      );

      await expect(Share.listPlatforms()).rejects.toMatchObject({
        code: 'E_NOT_INITIALIZED',
        message: 'initialize first',
      });
    });
  });

  describe('openSheet', () => {
    it('delegates to shareSheetController.show', async () => {
      (shareSheetController.show as jest.Mock).mockResolvedValue({
        code: 'success',
        platform: Platform.WECHAT_SESSION,
      });
      const r = await Share.openSheet({ type: 'text', text: 'hi' });
      expect(shareSheetController.show).toHaveBeenCalledWith(
        { type: 'text', text: 'hi' },
        {}
      );
      expect(r.code).toBe('success');
    });

    it.each([null, undefined, [], 'payload'])(
      'rejects non-object payload without opening the controller: %#',
      async (payload) => {
        await expect(Share.openSheet(payload as never)).rejects.toMatchObject({
          code: 'E_INVALID_OPTIONS',
        });
        expect(shareSheetController.show).not.toHaveBeenCalled();
      }
    );

    it.each([null, [], 'options'])(
      'rejects non-object sheet options without opening the controller: %#',
      async (options) => {
        await expect(
          Share.openSheet({ type: 'text', text: 'hi' }, options as never)
        ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
        expect(shareSheetController.show).not.toHaveBeenCalled();
      }
    );

    it.each([
      { type: 'text', text: '   ' },
      { type: 'image', image: '/relative.png' },
      { type: 'link', title: 'T', url: 'file:///tmp/file' },
      { type: 'unknown', text: 'hi' },
    ])('rejects malformed sheet payload %#', async (payload) => {
      await expect(Share.openSheet(payload as never)).rejects.toMatchObject({
        code: 'E_INVALID_OPTIONS',
      });
      expect(shareSheetController.show).not.toHaveBeenCalled();
    });

    it('forwards options', async () => {
      (shareSheetController.show as jest.Mock).mockResolvedValue({
        code: 'success',
        platform: Platform.DINGTALK,
      });
      await Share.openSheet({ type: 'text', text: 'hi' }, { title: 'X' });
      expect(shareSheetController.show).toHaveBeenCalledWith(
        { type: 'text', text: 'hi' },
        { title: 'X' }
      );
    });
  });
});
