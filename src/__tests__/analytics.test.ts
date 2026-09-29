jest.mock('../NativeUmengAnalytics', () => ({
  __esModule: true,
  default: { onEvent: jest.fn(), signIn: jest.fn(), signOut: jest.fn() },
}));
import Native from '../NativeUmengAnalytics';
import {
  trackEvent,
  bindAnalyticsUser,
  clearAnalyticsUser,
} from '../analytics';
import { UmengError } from '../UmengError';
beforeEach(() => jest.clearAllMocks());
it('hands off attributes synchronously and preserves finite numeric values', () => {
  expect(
    trackEvent({
      name: 'purchase',
      attributes: { count: 2, total: 1.5, zero: 0, label: 'hello' },
    })
  ).toBeUndefined();
  expect(Native!.onEvent).toHaveBeenCalledWith('purchase', {
    count: '2',
    total: '1.5',
    zero: '0',
    label: 'hello',
  });
  bindAnalyticsUser({ userId: 'user', provider: 'organization' });
  clearAnalyticsUser();
  expect(Native!.signIn).toHaveBeenCalledWith('user', 'organization');
  expect(Native!.signOut).toHaveBeenCalledTimes(1);
});
it.each([NaN, Infinity, -Infinity, null, true, {}])(
  'rejects invalid attribute %p before handing off',
  (value) => {
    expect(() =>
      trackEvent({ name: 'event', attributes: { value } } as never)
    ).toThrow(UmengError);
    expect(Native!.onEvent).not.toHaveBeenCalled();
  }
);
it('rejects missing identifiers synchronously', () => {
  expect(() => trackEvent({ name: '' })).toThrow(
    expect.objectContaining({ reason: 'invalid_input' })
  );
  expect(() => bindAnalyticsUser({ userId: ' ' })).toThrow(
    expect.objectContaining({ reason: 'invalid_input' })
  );
  expect(Native!.signIn).not.toHaveBeenCalled();
});
