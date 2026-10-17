jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  TurboModuleRegistry: {
    get: (name: string) =>
      name === 'UmengCommon'
        ? {
            initialize: jest.fn(async () => {}),
            getConfiguredShareTargets: jest.fn(async () => ['dingtalk']),
          }
        : null,
  },
}));

import NativeCommon from '../NativeUmengCommon';
import { initializeUmeng } from '../common';
import { getShareTargets, share } from '../share';

it('initializes Android without the iOS universal-link requirement', async () => {
  await initializeUmeng({
    appKey: 'app',
    wechat: { appId: 'id', appSecret: 'secret' },
  });
  expect(NativeCommon!.initialize).toHaveBeenCalledWith(
    expect.objectContaining({ appkey: 'app', wechatAppId: 'id' })
  );
});

it('normalizes partial native registration before selecting an installed target', async () => {
  await expect(getShareTargets()).rejects.toMatchObject({
    reason: 'unavailable',
  });
  await expect(
    share({ target: 'dingtalk', content: { type: 'text', text: 'hello' } })
  ).resolves.toMatchObject({
    status: 'failed',
    target: 'dingtalk',
    error: { reason: 'unavailable' },
  });
});
