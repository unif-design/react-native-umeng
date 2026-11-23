import { unsupported } from '../internal/errors/unsupported';
import type { AnalyticsEvent, AnalyticsUser } from '../types';

export function trackEvent(_input: Readonly<AnalyticsEvent>): void {
  throw unsupported();
}
export function bindAnalyticsUser(_input: Readonly<AnalyticsUser>): void {
  throw unsupported();
}
export function clearAnalyticsUser(): void {
  throw unsupported();
}
