import { createContext, useContext } from 'react';
import type { Platform } from '@unif/react-native-umeng';

import type { ShareContentDraft } from '../content/shareContent';
import type { OperationFeedback } from '../errors/classifyUmengError';
import type { NavigationState, RouteId } from '../navigation';
import type { DemoLog } from './logs';
import type { DirectShareType, PlatformState, SheetDraft } from './operations';
import type { CredentialDraft, SetupState, SetupAction } from './setupState';

export type SetupActions = {
  readonly updateCredential: (
    field: keyof CredentialDraft,
    value: string | boolean
  ) => void;
  readonly preInitialize: () => Promise<void>;
  readonly setConsent: (checked: boolean) => void;
  readonly initialize: () => Promise<void>;
  readonly retryInitialize: () => Promise<void>;
};

export type ShowcaseActions = SetupActions & {
  readonly navigate: (route: RouteId) => void;
  readonly back: () => void;
  readonly clearLogs: () => void;
  readonly refreshPlatforms: () => Promise<void>;
  readonly checkPlatform: (platform: Platform) => Promise<void>;
  readonly openShareSheet: (draft: SheetDraft) => Promise<void>;
  readonly shareDirect: (
    type: DirectShareType,
    platform: Platform,
    draft: ShareContentDraft
  ) => Promise<void>;
  readonly trackEvent: (
    eventId: string,
    params?: Record<string, string | number>
  ) => void;
  readonly signIn: (userId: string, provider?: string) => void;
  readonly signOut: () => void;
};

export type ShowcaseResultScope = 'sheet' | 'direct' | 'analytics';

export type ShowcaseOperationResult =
  | {
      readonly kind: 'success';
      readonly message: string;
    }
  | {
      readonly kind: 'feedback';
      readonly feedback: OperationFeedback;
    };

export type ShowcaseResults = Readonly<
  Record<ShowcaseResultScope, ShowcaseOperationResult | null>
>;

export type ShowcaseState = {
  readonly setup: SetupState;
  readonly navigation: NavigationState;
  readonly platforms: PlatformState;
  readonly results: ShowcaseResults;
  readonly logs: readonly DemoLog[];
};

export type ShowcaseContextValue = {
  readonly state: ShowcaseState;
  readonly actions: ShowcaseActions;
};

export const ShowcaseContext = createContext<ShowcaseContextValue | null>(null);

export function useShowcase(): ShowcaseContextValue {
  const value = useContext(ShowcaseContext);
  if (value === null) {
    throw new Error('useShowcase 必须在 ShowcaseProvider 内使用');
  }
  return value;
}

export type { SetupAction };
