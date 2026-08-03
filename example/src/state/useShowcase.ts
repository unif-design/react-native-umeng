import { createContext, useContext } from 'react';

import type { NavigationState } from '../navigation';
import type { DemoLog } from './logs';
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

export type ShowcaseState = {
  readonly setup: SetupState;
  readonly navigation: NavigationState;
  readonly logs: readonly DemoLog[];
};

export type ShowcaseContextValue = {
  readonly state: ShowcaseState;
  readonly actions: SetupActions;
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
