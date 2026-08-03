import NativeUmengAnalytics from './NativeUmengAnalytics';
import { UmengError } from './types';

function invalidOptions(message: string): never {
  throw new UmengError('E_INVALID_OPTIONS', message);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return invalidOptions(`\`${field}\` must be a non-empty string`);
  }
  return value;
}

/** 自定义事件埋点。value 为 number 时自动 stringify（友盟 iOS attributes 强制 NSString）。 */
export function onEvent(
  eventId: string,
  params?: Record<string, string | number>
): void {
  const validEventId = requireString(eventId, 'eventId');
  const stringifiedParams: Record<string, string> = {};
  if (params !== undefined) {
    if (
      typeof params !== 'object' ||
      params === null ||
      Array.isArray(params)
    ) {
      return invalidOptions('`params` must be an object');
    }

    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string') {
        stringifiedParams[k] = v;
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        stringifiedParams[k] = String(v);
      } else {
        return invalidOptions(
          `\`params.${k}\` must be a string or finite number`
        );
      }
    }
  }
  NativeUmengAnalytics.onEvent(validEventId, stringifiedParams);
}

/** 用户登录账号埋点。 */
export function signIn(userId: string, provider?: string): void {
  const validUserId = requireString(userId, 'userId');
  const validProvider =
    provider === undefined ? undefined : requireString(provider, 'provider');
  NativeUmengAnalytics.signIn(validUserId, validProvider);
}

/** 用户登出。 */
export function signOut(): void {
  NativeUmengAnalytics.signOut();
}
