/// <reference types="jest" />
import { normalizeError } from '../internal/errors';
import { UmengError } from '../types';
import {
  nativeMissingInitError,
  nativeVendorError,
  nativeWhitelistedObjectError,
} from './fixtures/nativeErrors';

describe('normalizeError', () => {
  it('returns an existing UmengError without changing its identity', () => {
    const original = new UmengError('E_USER_CANCEL', 'x');

    expect(normalizeError(original, 'E_UNKNOWN', 'fallback')).toBe(original);
  });

  it('preserves a whitelisted native error code and message', () => {
    const error = normalizeError(
      nativeMissingInitError,
      'E_SHARE_FAILED',
      'share failed'
    );

    expect(error).toMatchObject({
      code: 'E_NOT_INITIALIZED',
      message: 'missing init',
    });
    expect(error.nativeError).toBe(nativeMissingInitError);
  });

  it('uses fallbacks for an unknown code and empty message', () => {
    const error = normalizeError(nativeVendorError, 'E_UNKNOWN', 'fallback');

    expect(error).toMatchObject({ code: 'E_UNKNOWN', message: 'fallback' });
    expect(error.nativeError).toBe(nativeVendorError);
  });

  it('only lets ErrorCode whitelist values pass through objects', () => {
    const error = normalizeError(
      nativeWhitelistedObjectError,
      'E_UNKNOWN',
      'fallback'
    );

    expect(error).toMatchObject({
      code: 'E_SHARE_FAILED',
      message: 'native share failed',
    });
    expect(error.nativeError).toBe(nativeWhitelistedObjectError);
  });
});
