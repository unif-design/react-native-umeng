import { type ErrorCode, UmengError } from '../types';

const ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  'E_PLATFORM_NOT_INSTALLED',
  'E_PLATFORM_NOT_SUPPORTED',
  'E_INVALID_OPTIONS',
  'E_USER_CANCEL',
  'E_SHARE_FAILED',
  'E_NOT_INITIALIZED',
  'E_UNKNOWN',
]);

type NativeErrorLike = {
  code?: unknown;
  message?: unknown;
};

function asNativeErrorLike(error: unknown): NativeErrorLike | undefined {
  if (
    (typeof error === 'object' && error !== null) ||
    typeof error === 'function'
  ) {
    return error as NativeErrorLike;
  }
  return undefined;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && ERROR_CODES.has(value as ErrorCode);
}

export function normalizeError(
  error: unknown,
  fallbackCode: ErrorCode,
  fallbackMessage: string
): UmengError {
  if (error instanceof UmengError) {
    return error;
  }

  const nativeError = asNativeErrorLike(error);
  const code = nativeError?.code;
  const message = nativeError?.message;

  return new UmengError(
    isErrorCode(code) ? code : fallbackCode,
    typeof message === 'string' && message.trim().length > 0
      ? message
      : fallbackMessage,
    error
  );
}
