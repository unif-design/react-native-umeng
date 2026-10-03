import NativeUmengAnalytics from './NativeUmengAnalytics';
import { normalizeError, unavailable } from './internal/errors';
import {
  invalidInput,
  requireObject,
  requireString,
} from './internal/inputValidation';
import type { AnalyticsEvent, AnalyticsUser } from './types';

/** Synchronous handoff; return does not confirm upload to the analytics service. */
export function trackEvent(input: Readonly<AnalyticsEvent>): void {
  const event = requireObject(input, 'input');
  const name = requireString(event.name, 'name');
  const attributes: Record<string, string> = {};
  if (event.attributes !== undefined) {
    for (const [key, value] of Object.entries(
      requireObject(event.attributes, 'attributes')
    )) {
      if (
        typeof value !== 'string' &&
        !(typeof value === 'number' && Number.isFinite(value))
      )
        return invalidInput(
          `attributes.${key} must be a string or finite number`
        );
      Object.defineProperty(attributes, key, {
        value: String(value),
        enumerable: true,
      });
    }
  }
  try {
    if (!NativeUmengAnalytics) throw unavailable();
    NativeUmengAnalytics.onEvent(name, attributes);
  } catch (error) {
    throw normalizeError(error, 'sdk_failed', 'Failed to hand off event');
  }
}
export function bindAnalyticsUser(input: Readonly<AnalyticsUser>): void {
  const user = requireObject(input, 'input');
  const userId = requireString(user.userId, 'userId');
  const provider =
    user.provider === undefined
      ? undefined
      : requireString(user.provider, 'provider');
  try {
    if (!NativeUmengAnalytics) throw unavailable();
    NativeUmengAnalytics.signIn(userId, provider);
  } catch (error) {
    throw normalizeError(error, 'sdk_failed', 'Failed to bind analytics user');
  }
}
export function clearAnalyticsUser(): void {
  try {
    if (!NativeUmengAnalytics) throw unavailable();
    NativeUmengAnalytics.signOut();
  } catch (error) {
    throw normalizeError(error, 'sdk_failed', 'Failed to clear analytics user');
  }
}
