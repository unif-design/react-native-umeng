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

  it.each(['', '   ', null, 42])(
    'onEvent rejects invalid eventId synchronously: %#',
    (eventId) => {
      expect(() => Analytics.onEvent(eventId as never)).toThrow(
        expect.objectContaining({ code: 'E_INVALID_OPTIONS' })
      );
      expect(NativeUmengAnalytics.onEvent).not.toHaveBeenCalled();
    }
  );

  it.each([null, [], 'params'])(
    'onEvent rejects non-object params synchronously: %#',
    (params) => {
      expect(() => Analytics.onEvent('purchase', params as never)).toThrow(
        expect.objectContaining({ code: 'E_INVALID_OPTIONS' })
      );
      expect(NativeUmengAnalytics.onEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['boolean', true],
    ['null', null],
    ['object', {}],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative Infinity', Number.NEGATIVE_INFINITY],
  ])(
    'onEvent rejects invalid %s param values synchronously',
    (_label, amount) => {
      expect(() => Analytics.onEvent('purchase', { amount } as never)).toThrow(
        expect.objectContaining({ code: 'E_INVALID_OPTIONS' })
      );
      expect(NativeUmengAnalytics.onEvent).not.toHaveBeenCalled();
    }
  );

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

  it.each(['', '   ', null, 42])(
    'signIn rejects invalid userId synchronously: %#',
    (userId) => {
      expect(() => Analytics.signIn(userId as never)).toThrow(
        expect.objectContaining({ code: 'E_INVALID_OPTIONS' })
      );
      expect(NativeUmengAnalytics.signIn).not.toHaveBeenCalled();
    }
  );

  it.each(['', '   ', null, 42])(
    'signIn rejects invalid provider synchronously: %#',
    (provider) => {
      expect(() => Analytics.signIn('user-42', provider as never)).toThrow(
        expect.objectContaining({ code: 'E_INVALID_OPTIONS' })
      );
      expect(NativeUmengAnalytics.signIn).not.toHaveBeenCalled();
    }
  );

  it('signOut delegates', () => {
    expect(Analytics.signOut()).toBeUndefined();
    expect(NativeUmengAnalytics.signOut).toHaveBeenCalledTimes(1);
  });
});
