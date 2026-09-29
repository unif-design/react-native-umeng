import { UmengError } from '../../UmengError';
import type { UmengFailure } from '../../types';

import { NATIVE_ERROR_REASONS } from './constants';
import type { NativeError } from './types';

export function normalizeError(
  error: unknown,
  fallbackReason: UmengFailure['reason'],
  fallbackMessage: string
): UmengError {
  if (error instanceof UmengError) return error;
  const native =
    typeof error === 'object' && error !== null
      ? (error as NativeError)
      : undefined;
  const sourceCode = typeof native?.code === 'string' ? native.code : undefined;
  return new UmengError({
    reason:
      (sourceCode === undefined
        ? undefined
        : NATIVE_ERROR_REASONS[sourceCode]) ?? fallbackReason,
    message:
      typeof native?.message === 'string' && native.message.trim()
        ? native.message
        : fallbackMessage,
    ...(sourceCode === undefined ? {} : { sourceCode }),
  });
}
export function toFailure(error: unknown, message: string): UmengFailure {
  const normalized = normalizeError(error, 'sdk_failed', message);
  return {
    reason: normalized.reason,
    message: normalized.message,
    ...(normalized.sourceCode === undefined
      ? {}
      : { sourceCode: normalized.sourceCode }),
  };
}
export function unavailable(): UmengError {
  return new UmengError({
    reason: 'unavailable',
    message: 'Umeng native module is unavailable',
  });
}
