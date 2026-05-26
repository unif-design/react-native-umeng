/// <reference types="jest" />

jest.mock('../NativeUmengAnalytics', () => ({
  __esModule: true,
  default: {
    onEvent: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

import NativeUmengAnalytics from '../NativeUmengAnalytics';
import * as Analytics from '../analytics';

describe('Analytics', () => {
  beforeEach(() => {
    (NativeUmengAnalytics.onEvent as jest.Mock).mockClear();
    (NativeUmengAnalytics.signIn as jest.Mock).mockClear();
    (NativeUmengAnalytics.signOut as jest.Mock).mockClear();
  });

  it('onEvent forwards eventId and params', () => {
    Analytics.onEvent('login', { channel: 'wx' });
    expect(NativeUmengAnalytics.onEvent).toHaveBeenCalledWith('login', {
      channel: 'wx',
    });
  });

  it('onEvent with no params passes empty object', () => {
    Analytics.onEvent('open_app');
    expect(NativeUmengAnalytics.onEvent).toHaveBeenCalledWith('open_app', {});
  });

  it('onEvent stringifies number values', () => {
    Analytics.onEvent('purchase', { quantity: 3, price: 99.5 });
    expect(NativeUmengAnalytics.onEvent).toHaveBeenCalledWith('purchase', {
      quantity: '3',
      price: '99.5',
    });
  });

  it('signIn with userId only', () => {
    Analytics.signIn('user-42');
    expect(NativeUmengAnalytics.signIn).toHaveBeenCalledWith(
      'user-42',
      undefined
    );
  });

  it('signIn with provider', () => {
    Analytics.signIn('user-42', 'WX');
    expect(NativeUmengAnalytics.signIn).toHaveBeenCalledWith('user-42', 'WX');
  });

  it('signOut delegates', () => {
    Analytics.signOut();
    expect(NativeUmengAnalytics.signOut).toHaveBeenCalledTimes(1);
  });
});
