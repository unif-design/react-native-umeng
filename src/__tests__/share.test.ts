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
import * as Share from '../share';
import { Platform } from '../types';

describe('Share', () => {
  beforeEach(() => {
    (NativeUmengShare.shareText as jest.Mock).mockReset();
    (NativeUmengShare.shareImage as jest.Mock).mockReset();
    (NativeUmengShare.shareLink as jest.Mock).mockReset();
    (NativeUmengShare.isInstalled as jest.Mock).mockReset();
  });

  describe('shareText', () => {
    it('forwards platform + text to native and returns ShareResult', async () => {
      (NativeUmengShare.shareText as jest.Mock).mockResolvedValue({
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

    it('rejects E_PLATFORM_NOT_SUPPORTED for unknown platform', async () => {
      await expect(
        Share.shareText({ platform: 'unknown' as Platform, text: 'hi' })
      ).rejects.toMatchObject({ code: 'E_PLATFORM_NOT_SUPPORTED' });
    });

    it('maps native cancel to UmengError E_USER_CANCEL', async () => {
      (NativeUmengShare.shareText as jest.Mock).mockResolvedValue({
        code: 'cancel',
        message: 'user cancelled',
        platform: 'wechat_session',
      });
      await expect(
        Share.shareText({ platform: Platform.WECHAT_SESSION, text: 'hi' })
      ).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
    });

    it('maps native failed to UmengError E_SHARE_FAILED', async () => {
      (NativeUmengShare.shareText as jest.Mock).mockResolvedValue({
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
  });

  describe('shareImage', () => {
    it('forwards optional thumb', async () => {
      (NativeUmengShare.shareImage as jest.Mock).mockResolvedValue({
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
  });

  describe('shareLink', () => {
    it('forwards all fields', async () => {
      (NativeUmengShare.shareLink as jest.Mock).mockResolvedValue({
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
  });

  describe('isInstalled', () => {
    it('returns boolean from native', async () => {
      (NativeUmengShare.isInstalled as jest.Mock).mockResolvedValue(true);
      await expect(Share.isInstalled(Platform.WECHAT_SESSION)).resolves.toBe(
        true
      );
    });
  });

  describe('listPlatforms', () => {
    it('returns SUPPORTED_PLATFORMS with installed/displayName', async () => {
      (NativeUmengShare.isInstalled as jest.Mock).mockImplementation(
        (p: string) => Promise.resolve(p === 'wechat_session')
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
  });

  describe('openSheet', () => {
    it('delegates to shareSheetController.show', async () => {
      const {
        shareSheetController,
      } = require('../ShareSheet/ShareSheetController');
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

    it('forwards options', async () => {
      const {
        shareSheetController,
      } = require('../ShareSheet/ShareSheetController');
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
