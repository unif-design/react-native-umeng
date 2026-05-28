/// <reference types="jest" />

jest.mock('../NativeUmengCommon', () => ({
  __esModule: true,
  default: {
    preInit: jest.fn().mockResolvedValue(undefined),
    init: jest.fn().mockResolvedValue(undefined),
    isInited: jest.fn().mockResolvedValue(false),
  },
}));

import NativeUmengCommon from '../NativeUmengCommon';
import * as Common from '../common';

const CONFIG = {
  appkey: 'YOUR_APPKEY',
  channel: 'App Store',
  wechatAppId: 'wxXXX',
  wechatAppSecret: 'secretXXX',
  dingtalkAppId: 'dingoaXXX',
};

describe('Common', () => {
  beforeEach(() => {
    (NativeUmengCommon.preInit as jest.Mock).mockClear();
    (NativeUmengCommon.preInit as jest.Mock).mockResolvedValue(undefined);
    (NativeUmengCommon.init as jest.Mock).mockClear();
    (NativeUmengCommon.init as jest.Mock).mockResolvedValue(undefined);
    (NativeUmengCommon.isInited as jest.Mock).mockClear();
    (NativeUmengCommon.isInited as jest.Mock).mockResolvedValue(false);
    Common.__resetForTests();
  });

  describe('preInit', () => {
    it('forwards config to native and is idempotent', async () => {
      await Common.preInit(CONFIG);
      await Common.preInit(CONFIG);
      expect(NativeUmengCommon.preInit).toHaveBeenCalledTimes(1);
      expect(NativeUmengCommon.preInit).toHaveBeenCalledWith(CONFIG);
    });

    it('rejects with E_INVALID_OPTIONS when appkey is missing', async () => {
      await expect(
        Common.preInit({ appkey: '' as string } as Parameters<
          typeof Common.preInit
        >[0])
      ).rejects.toMatchObject({ code: 'E_INVALID_OPTIONS' });
      expect(NativeUmengCommon.preInit).not.toHaveBeenCalled();
    });

    it('propagates native errors and allows retry', async () => {
      const err = new Error('boom');
      (NativeUmengCommon.preInit as jest.Mock).mockRejectedValueOnce(err);
      await expect(Common.preInit(CONFIG)).rejects.toThrow('boom');
      await Common.preInit(CONFIG);
      expect(NativeUmengCommon.preInit).toHaveBeenCalledTimes(2);
    });
  });

  describe('init', () => {
    it('calls native init and is idempotent', async () => {
      await Common.init();
      await Common.init();
      expect(NativeUmengCommon.init).toHaveBeenCalledTimes(1);
    });

    it('propagates native errors and allows retry', async () => {
      const err = new Error('preinit missing');
      (NativeUmengCommon.init as jest.Mock).mockRejectedValueOnce(err);
      await expect(Common.init()).rejects.toThrow('preinit missing');
      await Common.init();
      expect(NativeUmengCommon.init).toHaveBeenCalledTimes(2);
    });
  });

  describe('isInited', () => {
    it('delegates to native', async () => {
      (NativeUmengCommon.isInited as jest.Mock).mockResolvedValueOnce(true);
      await expect(Common.isInited()).resolves.toBe(true);
      expect(NativeUmengCommon.isInited).toHaveBeenCalledTimes(1);
    });
  });
});
