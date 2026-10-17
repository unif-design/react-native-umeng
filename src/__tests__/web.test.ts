import { renderHook } from '@testing-library/react-native';
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

it('rejects analytics user changes and keeps its unsupported sheet controller stable', async () => {
  expect(() => api.bindAnalyticsUser({ userId: 'user' })).toThrow(
    expect.objectContaining({ reason: 'unsupported' })
  );
  expect(() => api.clearAnalyticsUser()).toThrow(
    expect.objectContaining({ reason: 'unsupported' })
  );
  const hook = renderHook(() => api.useShareSheet());
  const controller = hook.result.current[0];
  await expect(
    controller.open({ type: 'text', text: 'hello' })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unsupported' },
  });
  hook.rerender({});
  expect(hook.result.current[0]).toBe(controller);
  hook.unmount();
});
