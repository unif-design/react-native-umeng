import type { UmengFailure } from '../../types';

export const NATIVE_ERROR_REASONS: Readonly<
  Record<string, UmengFailure['reason']>
> = {
  E_INVALID_OPTIONS: 'invalid_input',
  E_CONFIGURATION_LOCKED: 'configuration_locked',
  E_NOT_INITIALIZED: 'not_initialized',
  E_PLATFORM_NOT_INSTALLED: 'not_installed',
  E_BUSY: 'busy',
  E_PLATFORM_NOT_SUPPORTED: 'unsupported',
  E_UNAVAILABLE: 'unavailable',
  E_SHARE_FAILED: 'sdk_failed',
  E_UNKNOWN: 'sdk_failed',
};
