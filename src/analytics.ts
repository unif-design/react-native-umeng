import NativeUmengAnalytics from './NativeUmengAnalytics';

/** 自定义事件埋点。value 为 number 时自动 stringify（友盟 iOS attributes 强制 NSString）。 */
export function onEvent(
  eventId: string,
  params?: Record<string, string | number>
): void {
  const stringifiedParams: Record<string, string> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      stringifiedParams[k] = typeof v === 'string' ? v : String(v);
    }
  }
  NativeUmengAnalytics.onEvent(eventId, stringifiedParams);
}

/** 用户登录账号埋点。 */
export function signIn(userId: string, provider?: string): void {
  NativeUmengAnalytics.signIn(userId, provider);
}

/** 用户登出。 */
export function signOut(): void {
  NativeUmengAnalytics.signOut();
}
