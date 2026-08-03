import {
  Common,
  Share,
  Analytics,
  ShareSheetHost,
  Platform,
  SUPPORTED_PLATFORMS,
  UmengError,
  shareSuccess,
  shareCancel,
  shareFailed,
} from '../mock';

describe('mock', () => {
  it('Common/Share/Analytics 方法都是 jest mock', () => {
    expect(jest.isMockFunction(Common.preInit)).toBe(true);
    expect(jest.isMockFunction(Common.init)).toBe(true);
    expect(jest.isMockFunction(Common.isInited)).toBe(true);
    expect(jest.isMockFunction(Share.shareText)).toBe(true);
    expect(jest.isMockFunction(Share.openSheet)).toBe(true);
    expect(jest.isMockFunction(Analytics.onEvent)).toBe(true);
    expect(Common).not.toHaveProperty('__resetForTests');
  });

  it('Common.isInited 默认 false', async () => {
    await expect(Common.isInited()).resolves.toBe(false);
  });

  it('Share.shareText 默认 success', async () => {
    await expect(
      Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' })
    ).resolves.toEqual({ code: 'success', platform: Platform.WECHAT_SESSION });
  });

  it('结果可按单次调用覆盖', async () => {
    const error = shareCancel(Platform.DINGTALK);
    expect(error).toBeInstanceOf(UmengError);

    (Share.shareText as jest.Mock).mockRejectedValueOnce(error);
    await expect(
      Share.shareText({ platform: Platform.DINGTALK, text: 'hi' })
    ).rejects.toMatchObject({
      code: 'E_USER_CANCEL',
      message: 'User cancelled',
      nativeError: { platform: Platform.DINGTALK },
    });
  });

  it('shareFailed creates an E_SHARE_FAILED UmengError', () => {
    const error = shareFailed(Platform.WECHAT_SESSION);

    expect(error).toBeInstanceOf(UmengError);
    expect(error).toMatchObject({
      code: 'E_SHARE_FAILED',
      message: 'mock failed',
      nativeError: { platform: Platform.WECHAT_SESSION },
    });
  });

  it('listPlatforms 返回全平台 installed', async () => {
    await expect(Share.listPlatforms()).resolves.toEqual(
      SUPPORTED_PLATFORMS.map((platform) => ({
        platform,
        installed: true,
        displayName: expect.any(String),
      }))
    );
  });

  it('ShareSheetHost 渲染 null', () => {
    expect(ShareSheetHost({})).toBeNull();
  });

  it('纯导出仍是真实值', () => {
    expect(Platform.WECHAT_SESSION).toBe('wechat_session');
    expect(new UmengError('E_UNKNOWN', 'x')).toBeInstanceOf(Error);
    expect(shareSuccess(Platform.DINGTALK)).toEqual({
      code: 'success',
      platform: Platform.DINGTALK,
    });
  });
});
