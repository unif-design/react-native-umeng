jest.mock('../NativeUmengCommon', () => {
  throw new Error('Web must not load native');
});
jest.mock('../NativeUmengShare', () => {
  throw new Error('Web must not load native');
});
jest.mock('../NativeUmengAnalytics', () => {
  throw new Error('Web must not load native');
});
import * as api from '../index.web';
it('keeps native SDK out of Web and returns unsupported instead of fake success or no apps', async () => {
  await expect(api.initializeUmeng({ appKey: 'app' })).rejects.toMatchObject({
    reason: 'unsupported',
  });
  await expect(api.isUmengInitialized()).rejects.toMatchObject({
    reason: 'unsupported',
  });
  await expect(api.getShareTargets()).rejects.toMatchObject({
    reason: 'unsupported',
  });
  await expect(
    api.share({ target: 'dingtalk', content: { type: 'text', text: 'hello' } })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  expect(() => api.trackEvent({ name: 'event' })).toThrow(
    expect.objectContaining({ reason: 'unsupported' })
  );
});
