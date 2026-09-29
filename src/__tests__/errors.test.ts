import { normalizeError, toFailure } from '../internal/errors';
import { UmengError } from '../UmengError';
it('maps source errors into a plain public failure without native payloads', () => {
  const source = {
    code: 'E_CONFIGURATION_LOCKED',
    message: 'config changed',
    config: { appKey: 'secret' },
  };
  expect(toFailure(source, 'fallback')).toEqual({
    reason: 'configuration_locked',
    message: 'config changed',
    sourceCode: 'E_CONFIGURATION_LOCKED',
  });
});
it('preserves UmengError and uses a specific fallback for unknown native errors', () => {
  const error = new UmengError({
    reason: 'invalid_response',
    message: 'invalid receipt',
  });
  expect(normalizeError(error, 'sdk_failed', 'fallback')).toBe(error);
  expect(normalizeError(null, 'sdk_failed', 'fallback')).toMatchObject({
    reason: 'sdk_failed',
    message: 'fallback',
  });
});
