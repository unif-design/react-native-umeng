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
