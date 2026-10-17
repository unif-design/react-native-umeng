jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  TurboModuleRegistry: { get: () => null },
}));

import { initializeUmeng, isUmengInitialized } from '../common';
import { getShareTargets, share } from '../share';
import {
  trackEvent,
  bindAnalyticsUser,
  clearAnalyticsUser,
} from '../analytics';

it('reports missing native registration through the public failure contracts', async () => {
  await expect(initializeUmeng({ appKey: 'app' })).rejects.toMatchObject({
    reason: 'unavailable',
  });
  await expect(isUmengInitialized()).rejects.toMatchObject({
    reason: 'unavailable',
  });
  await expect(getShareTargets()).rejects.toMatchObject({
    reason: 'unavailable',
  });
  await expect(
    share({ target: 'dingtalk', content: { type: 'text', text: 'hello' } })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unavailable' },
  });
  expect(() => trackEvent({ name: 'event' })).toThrow(
    expect.objectContaining({ reason: 'unavailable' })
  );
  expect(() => bindAnalyticsUser({ userId: 'user' })).toThrow(
    expect.objectContaining({ reason: 'unavailable' })
  );
  expect(() => clearAnalyticsUser()).toThrow(
    expect.objectContaining({ reason: 'unavailable' })
  );
});
