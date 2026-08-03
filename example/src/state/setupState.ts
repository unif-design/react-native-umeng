import type { UmengInitConfig } from '@unif/react-native-umeng';

import type { OperationFeedback } from '../errors/classifyUmengError';

export type CredentialDraft = {
  readonly appkey: string;
  readonly channel: string;
  readonly wechatEnabled: boolean;
  readonly wechatAppId: string;
  readonly wechatAppSecret: string;
  readonly wechatUniversalLink: string;
  readonly dingtalkEnabled: boolean;
  readonly dingtalkAppId: string;
};

export type CredentialErrors = Partial<Record<keyof CredentialDraft, string>>;

export type SetupOS = 'android' | 'ios';

export type ValidationResult<T> =
  | { readonly ok: true; readonly config: T }
  | { readonly ok: false; readonly errors: CredentialErrors };

export type SetupPhase =
  | 'editing'
  | 'preInitializing'
  | 'awaitingConsent'
  | 'initializing'
  | 'initialized'
  | 'initFailedLocked';

export type SetupState = {
  readonly phase: SetupPhase;
  readonly draft: CredentialDraft;
  readonly errors: CredentialErrors;
  readonly consent: boolean;
  readonly configSnapshot: Readonly<UmengInitConfig> | null;
  readonly feedback: OperationFeedback | null;
};

export type SetupAction =
  | {
      readonly type: 'updateCredential';
      readonly field: keyof CredentialDraft;
      readonly value: string | boolean;
    }
  | {
      readonly type: 'validationFailed';
      readonly errors: CredentialErrors;
    }
  | { readonly type: 'preInitializeStarted' }
  | {
      readonly type: 'preInitializeSucceeded';
      readonly configSnapshot: Readonly<UmengInitConfig>;
    }
  | {
      readonly type: 'preInitializeFailed';
      readonly feedback: OperationFeedback;
    }
  | { readonly type: 'setConsent'; readonly checked: boolean }
  | { readonly type: 'initializeStarted' }
  | { readonly type: 'initializeSucceeded' }
  | {
      readonly type: 'initializeFailed';
      readonly feedback: OperationFeedback;
    };

export const EMPTY_CREDENTIAL_DRAFT: CredentialDraft = Object.freeze({
  appkey: '',
  channel: '',
  wechatEnabled: false,
  wechatAppId: '',
  wechatAppSecret: '',
  wechatUniversalLink: '',
  dingtalkEnabled: false,
  dingtalkAppId: '',
});

function isPlaceholder(value: string): boolean {
  return /^YOUR(?:_|$)/i.test(value);
}

function isAbsoluteHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function hasOwnErrors(errors: CredentialErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function buildInitConfig(
  draft: CredentialDraft,
  os: SetupOS
): ValidationResult<UmengInitConfig> {
  const errors: CredentialErrors = {};
  const appkey = draft.appkey.trim();
  const channel = draft.channel.trim();

  if (appkey.length === 0) {
    errors.appkey = '请输入 Umeng AppKey';
  } else if (isPlaceholder(appkey)) {
    errors.appkey = '请替换 Umeng AppKey 占位值';
  }

  if (draft.channel.length > 0 && channel.length === 0) {
    errors.channel = 'Channel 不能只包含空格';
  } else if (isPlaceholder(channel)) {
    errors.channel = '请替换 Channel 占位值';
  }

  const config: UmengInitConfig = { appkey };
  if (channel.length > 0) {
    config.channel = channel;
  }

  if (draft.wechatEnabled) {
    const wechatAppId = draft.wechatAppId.trim();
    const wechatAppSecret = draft.wechatAppSecret.trim();
    const wechatUniversalLink = draft.wechatUniversalLink.trim();

    if (wechatAppId.length === 0) {
      errors.wechatAppId = '请输入微信 App ID';
    } else if (isPlaceholder(wechatAppId)) {
      errors.wechatAppId = '请替换微信 App ID 占位值';
    }

    if (wechatAppSecret.length === 0) {
      errors.wechatAppSecret = '请输入微信 App Secret';
    } else if (isPlaceholder(wechatAppSecret)) {
      errors.wechatAppSecret = '请替换微信 App Secret 占位值';
    }

    if (os === 'ios' && wechatUniversalLink.length === 0) {
      errors.wechatUniversalLink = '请输入 HTTPS Universal Link';
    } else if (
      draft.wechatUniversalLink.length > 0 &&
      wechatUniversalLink.length === 0
    ) {
      errors.wechatUniversalLink = 'Universal Link 不能只包含空格';
    } else if (
      wechatUniversalLink.length > 0 &&
      !isAbsoluteHttpsUrl(wechatUniversalLink)
    ) {
      errors.wechatUniversalLink = '请输入带 host 的绝对 HTTPS Universal Link';
    } else if (isPlaceholder(wechatUniversalLink)) {
      errors.wechatUniversalLink = '请替换 Universal Link 占位值';
    }

    config.wechatAppId = wechatAppId;
    config.wechatAppSecret = wechatAppSecret;
    if (wechatUniversalLink.length > 0) {
      config.wechatUniversalLink = wechatUniversalLink;
    }
  }

  if (draft.dingtalkEnabled) {
    const dingtalkAppId = draft.dingtalkAppId.trim();
    if (dingtalkAppId.length === 0) {
      errors.dingtalkAppId = '请输入钉钉 App ID';
    } else if (isPlaceholder(dingtalkAppId)) {
      errors.dingtalkAppId = '请替换钉钉 App ID 占位值';
    }
    config.dingtalkAppId = dingtalkAppId;
  }

  return hasOwnErrors(errors) ? { ok: false, errors } : { ok: true, config };
}

export function createInitialSetupState(): SetupState {
  return {
    phase: 'editing',
    draft: { ...EMPTY_CREDENTIAL_DRAFT },
    errors: {},
    consent: false,
    configSnapshot: null,
    feedback: null,
  };
}

function updateCredential(
  draft: CredentialDraft,
  field: keyof CredentialDraft,
  value: string | boolean
): CredentialDraft | null {
  if (field === 'wechatEnabled' || field === 'dingtalkEnabled') {
    return typeof value === 'boolean' ? { ...draft, [field]: value } : null;
  }

  return typeof value === 'string' ? { ...draft, [field]: value } : null;
}

function assertNever(_action: never): never {
  throw new Error('未知初始化操作');
}

export function setupReducer(
  state: SetupState,
  action: SetupAction
): SetupState {
  switch (action.type) {
    case 'updateCredential': {
      if (state.phase !== 'editing') {
        return state;
      }

      const draft = updateCredential(state.draft, action.field, action.value);
      if (draft === null) {
        return state;
      }

      const errors = { ...state.errors };
      delete errors[action.field];
      return { ...state, draft, errors, feedback: null };
    }
    case 'validationFailed':
      return state.phase === 'editing'
        ? { ...state, errors: action.errors, feedback: null }
        : state;
    case 'preInitializeStarted':
      return state.phase === 'editing'
        ? {
            ...state,
            phase: 'preInitializing',
            errors: {},
            feedback: null,
          }
        : state;
    case 'preInitializeSucceeded':
      return state.phase === 'preInitializing'
        ? {
            ...state,
            phase: 'awaitingConsent',
            draft: { ...state.draft, wechatAppSecret: '' },
            consent: false,
            configSnapshot: action.configSnapshot,
            feedback: null,
          }
        : state;
    case 'preInitializeFailed':
      return state.phase === 'preInitializing'
        ? {
            ...state,
            phase: 'editing',
            configSnapshot: null,
            feedback: action.feedback,
          }
        : state;
    case 'setConsent':
      return state.phase === 'awaitingConsent'
        ? { ...state, consent: action.checked }
        : state;
    case 'initializeStarted':
      return (state.phase === 'awaitingConsent' && state.consent) ||
        state.phase === 'initFailedLocked'
        ? { ...state, phase: 'initializing', feedback: null }
        : state;
    case 'initializeSucceeded':
      return state.phase === 'initializing'
        ? { ...state, phase: 'initialized', feedback: null }
        : state;
    case 'initializeFailed':
      return state.phase === 'initializing'
        ? {
            ...state,
            phase: 'initFailedLocked',
            feedback: action.feedback,
          }
        : state;
    default:
      return assertNever(action);
  }
}
