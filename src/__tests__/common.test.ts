/// <reference types="jest" />

jest.mock('../NativeUmengCommon', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(undefined),
    isInited: jest.fn().mockResolvedValue(false),
  },
}));

import NativeUmengCommon from '../NativeUmengCommon';
import * as Common from '../common';

describe('Common', () => {
  beforeEach(() => {
    (NativeUmengCommon.init as jest.Mock).mockClear();
    (NativeUmengCommon.init as jest.Mock).mockResolvedValue(undefined);
    (NativeUmengCommon.isInited as jest.Mock).mockClear();
    (NativeUmengCommon.isInited as jest.Mock).mockResolvedValue(false);
    Common.__resetForTests();
  });

  it('init resolves and is idempotent (native called once)', async () => {
    await Common.init();
    await Common.init();
    expect(NativeUmengCommon.init).toHaveBeenCalledTimes(1);
  });

  it('isInited delegates to native', async () => {
    (NativeUmengCommon.isInited as jest.Mock).mockResolvedValueOnce(true);
    await expect(Common.isInited()).resolves.toBe(true);
    expect(NativeUmengCommon.isInited).toHaveBeenCalledTimes(1);
  });

  it('init propagates native errors and allows retry', async () => {
    const err = new Error('boom');
    (NativeUmengCommon.init as jest.Mock).mockRejectedValueOnce(err);
    await expect(Common.init()).rejects.toThrow('boom');
    // 第二次调应当再次尝试（之前 reject 后清除缓存）
    await Common.init();
    expect(NativeUmengCommon.init).toHaveBeenCalledTimes(2);
  });
});
