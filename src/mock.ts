// Official Jest boundary. Configure results explicitly in consumer tests.
import { createElement, Fragment, useState } from 'react';
import type {
  UmengConfiguration,
  ShareTarget,
  ShareResult,
  ShareTargetInfo,
  ShareRequest,
  ShareSheetController,
  ShareSheet,
  ShareContent,
  ShareSheetCallOptions,
  AnalyticsEvent,
  AnalyticsUser,
  UmengFailure,
} from './types';
export { UmengError } from './UmengError';
export type * from './types';

export const shareSuccess = (target: ShareTarget): ShareResult => ({
  status: 'success',
  target,
});
export const shareCancelled = (target?: ShareTarget): ShareResult => ({
  status: 'cancelled',
  ...(target === undefined ? {} : { target }),
});
export const shareFailed = (
  error: UmengFailure,
  target?: ShareTarget
): ShareResult => ({
  status: 'failed',
  error,
  ...(target === undefined ? {} : { target }),
});

export const initializeUmeng = jest.fn(
  (_config: Readonly<UmengConfiguration>): Promise<void> => Promise.resolve()
);
export const isUmengInitialized = jest.fn(
  (): Promise<boolean> => Promise.resolve(false)
);
export const getShareTargets = jest.fn(
  (): Promise<readonly ShareTargetInfo[]> =>
    Promise.resolve([
      { target: 'wechat_session', label: '微信', installed: true },
      { target: 'dingtalk', label: '钉钉', installed: true },
    ])
);
export const share = jest.fn(
  (input: Readonly<ShareRequest>): Promise<ShareResult> =>
    Promise.resolve(shareSuccess(input.target))
);
export const useShareSheet = jest.fn(function useMockShareSheet(): ShareSheet {
  const [controller] = useState<ShareSheetController>(() => ({
    open: jest.fn(
      (
        _content: Readonly<ShareContent>,
        options?: ShareSheetCallOptions
      ): Promise<ShareResult> => {
        options?.onDismiss?.();
        return Promise.resolve(shareCancelled());
      }
    ),
  }));
  const [host] = useState(() => createElement(Fragment));
  return [controller, host] as const;
});
export const trackEvent = jest.fn(
  (_input: Readonly<AnalyticsEvent>): void => {}
);
export const bindAnalyticsUser = jest.fn(
  (_input: Readonly<AnalyticsUser>): void => {}
);
export const clearAnalyticsUser = jest.fn((): void => {});
