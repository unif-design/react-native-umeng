import { createElement, Fragment, useState } from 'react';
import { UmengError } from './UmengError';
import type {
  UmengConfiguration,
  ShareRequest,
  ShareResult,
  ShareTargetInfo,
  AnalyticsEvent,
  AnalyticsUser,
  ShareSheet,
  ShareSheetController,
} from './types';
export { UmengError } from './UmengError';
export type {
  ShareTarget,
  WeChatConfiguration,
  DingTalkConfiguration,
  UmengConfiguration,
  UmengFailure,
  ShareTargetInfo,
  ShareTextContent,
  ShareImageContent,
  ShareLinkContent,
  ShareContent,
  ShareRequest,
  ShareSucceeded,
  ShareCancelled,
  ShareFailed,
  ShareResult,
  ShareSheetOptions,
  ShareSheetCallOptions,
  ShareSheetController,
  AnalyticsEvent,
  AnalyticsUser,
} from './types';

function unsupported(): UmengError {
  return new UmengError({
    reason: 'unsupported',
    message: 'Umeng is available only on iOS and Android',
  });
}
export function initializeUmeng(
  _config: Readonly<UmengConfiguration>
): Promise<void> {
  return Promise.reject(unsupported());
}
export function isUmengInitialized(): Promise<boolean> {
  return Promise.reject(unsupported());
}
export function getShareTargets(): Promise<readonly ShareTargetInfo[]> {
  return Promise.reject(unsupported());
}
export function share(_input: Readonly<ShareRequest>): Promise<ShareResult> {
  return Promise.resolve({
    status: 'failed',
    error: { reason: 'unsupported', message: unsupported().message },
  });
}
export function trackEvent(_input: Readonly<AnalyticsEvent>): void {
  throw unsupported();
}
export function bindAnalyticsUser(_input: Readonly<AnalyticsUser>): void {
  throw unsupported();
}
export function clearAnalyticsUser(): void {
  throw unsupported();
}
export function useShareSheet(): ShareSheet {
  const [controller] = useState<ShareSheetController>(() => ({
    open: () =>
      Promise.resolve({
        status: 'failed',
        error: { reason: 'unsupported', message: unsupported().message },
      }),
  }));
  const [host] = useState(() => createElement(Fragment));
  return [controller, host] as const;
}
