import { renderHook } from '@testing-library/react-native';
import {
  share,
  shareSuccess,
  shareCancelled,
  shareFailed,
  initializeUmeng,
  trackEvent,
} from '../mock';
it('provides explicit success, cancellation and failure results for consumers', async () => {
  const request = {
    target: 'dingtalk',
    content: { type: 'text', text: 'hello' },
  } as const;
  await expect(share(request)).resolves.toEqual(shareSuccess('dingtalk'));
  share.mockResolvedValueOnce(shareCancelled());
  await expect(share(request)).resolves.toEqual({ status: 'cancelled' });
  share.mockResolvedValueOnce(
    shareFailed({ reason: 'busy', message: 'busy' }, 'dingtalk')
  );
  await expect(share(request)).resolves.toMatchObject({
    status: 'failed',
    target: 'dingtalk',
    error: { reason: 'busy' },
  });
  await expect(initializeUmeng({ appKey: 'app' })).resolves.toBeUndefined();
  expect(trackEvent({ name: 'event' })).toBeUndefined();
});

it('provides consumer readiness, targets and a stable cancelling sheet with optional dismissal', async () => {
  const api: typeof import('../mock') = require('../mock');
  await expect(api.isUmengInitialized()).resolves.toBe(false);
  await expect(api.getShareTargets()).resolves.toEqual([
    { target: 'wechat_session', label: '微信', installed: true },
    { target: 'dingtalk', label: '钉钉', installed: true },
  ]);
  expect(api.shareCancelled('dingtalk')).toEqual({
    status: 'cancelled',
    target: 'dingtalk',
  });
  expect(api.shareFailed({ reason: 'busy', message: 'busy' })).toEqual({
    status: 'failed',
    error: { reason: 'busy', message: 'busy' },
  });
  expect(api.bindAnalyticsUser({ userId: 'user' })).toBeUndefined();
  expect(api.clearAnalyticsUser()).toBeUndefined();
  const hook = renderHook(() => api.useShareSheet());
  const controller = hook.result.current[0];
  const content = { type: 'text', text: 'hello' } as const;
  await expect(controller.open(content)).resolves.toEqual({
    status: 'cancelled',
  });
  await expect(controller.open(content, {})).resolves.toEqual({
    status: 'cancelled',
  });
  const onDismiss = jest.fn();
  await expect(controller.open(content, { onDismiss })).resolves.toEqual({
    status: 'cancelled',
  });
  expect(onDismiss).toHaveBeenCalledTimes(1);
  hook.rerender({});
  expect(hook.result.current[0]).toBe(controller);
  hook.unmount();
});
