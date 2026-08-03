import { act, render } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import {
  Analytics,
  Common,
  PLATFORM_DISPLAY_NAMES,
  Platform,
  Share,
  UmengError,
  type PlatformInfo,
} from '@unif/react-native-umeng';
import {
  shareCancel,
  shareFailed,
  shareSuccess,
} from '@unif/react-native-umeng/mock';

import type { ShareContentDraft } from '../content/shareContent';
import { ShowcaseProvider } from '../state/ShowcaseProvider';
import type { SheetDraft } from '../state/operations';
import { useShowcase, type ShowcaseContextValue } from '../state/useShowcase';

jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);

const mockedCommon = jest.mocked(Common);
const mockedShare = jest.mocked(Share);
const mockedAnalytics = jest.mocked(Analytics);
const sensitiveCredentials = {
  appkey: 'sensitive-app-key',
  wechatAppId: 'sensitive-wechat-app-id',
  wechatAppSecret: 'sensitive-wechat-secret',
  wechatUniversalLink: 'https://sensitive.example/universal-link',
  dingtalkAppId: 'sensitive-dingtalk-app-id',
} as const;
const validDraft: ShareContentDraft = {
  text: 'sensitive share body',
  image: 'https://sensitive.example/image.png',
  title: 'sensitive share title',
  url: 'https://sensitive.example/page?credential=value',
  description: 'sensitive share description',
  thumb: 'https://sensitive.example/thumb.png',
};
const sheetOptions = {
  title: 'sensitive sheet title',
  cancelText: 'sensitive cancel text',
  wechatSubtitle: 'sensitive WeChat subtitle',
  dingtalkSubtitle: 'sensitive DingTalk subtitle',
  hideUninstalled: true,
} as const;
const defaultPlatformItems: readonly PlatformInfo[] = [
  {
    platform: Platform.WECHAT_SESSION,
    installed: true,
    displayName: PLATFORM_DISPLAY_NAMES[Platform.WECHAT_SESSION],
  },
  {
    platform: Platform.DINGTALK,
    installed: true,
    displayName: PLATFORM_DISPLAY_NAMES[Platform.DINGTALK],
  },
];

let currentContext: ShowcaseContextValue | undefined;

function Probe(): null {
  currentContext = useShowcase();
  return null;
}

function Harness({ children }: PropsWithChildren): ReactElement {
  return <ShowcaseProvider>{children}</ShowcaseProvider>;
}

function current(): ShowcaseContextValue {
  if (currentContext === undefined) {
    throw new Error('Showcase context is not mounted');
  }

  return currentContext;
}

async function enterAwaitingConsent(): Promise<void> {
  act(() => {
    current().actions.updateCredential('appkey', sensitiveCredentials.appkey);
  });
  await act(async () => {
    await current().actions.preInitialize();
  });
}

async function enterInitialized(): Promise<void> {
  await enterAwaitingConsent();
  act(() => {
    current().actions.setConsent(true);
  });
  await act(async () => {
    await current().actions.initialize();
  });
}

function restoreOfficialMockDefaults(): void {
  currentContext = undefined;
  mockedCommon.preInit.mockResolvedValue(undefined);
  mockedCommon.init.mockResolvedValue(undefined);
  mockedCommon.isInited.mockResolvedValue(true);
  mockedShare.listPlatforms.mockImplementation(() =>
    Promise.resolve(defaultPlatformItems.map((item) => ({ ...item })))
  );
  mockedShare.isInstalled.mockResolvedValue(true);
  mockedShare.shareText.mockImplementation((options) =>
    Promise.resolve(shareSuccess(options.platform))
  );
  mockedShare.shareImage.mockImplementation((options) =>
    Promise.resolve(shareSuccess(options.platform))
  );
  mockedShare.shareLink.mockImplementation((options) =>
    Promise.resolve(shareSuccess(options.platform))
  );
  mockedShare.openSheet.mockResolvedValue(
    shareSuccess(Platform.WECHAT_SESSION)
  );
  mockedAnalytics.onEvent.mockImplementation(() => undefined);
  mockedAnalytics.signIn.mockImplementation(() => undefined);
  mockedAnalytics.signOut.mockImplementation(() => undefined);
}

beforeEach(() => {
  restoreOfficialMockDefaults();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('ShowcaseProvider setup flow', () => {
  it('keeps invalid credentials editable and never touches Common', async () => {
    render(<Probe />, { wrapper: Harness });

    await act(async () => {
      await current().actions.preInitialize();
    });

    expect(current().state.setup).toMatchObject({
      phase: 'editing',
      errors: { appkey: '请输入 Umeng AppKey' },
      configSnapshot: null,
    });
    expect(mockedCommon.preInit).not.toHaveBeenCalled();
    expect(mockedCommon.init).not.toHaveBeenCalled();
    expect(mockedCommon.isInited).not.toHaveBeenCalled();
  });

  it('returns to editing after preInit rejects without leaking the input or native error', async () => {
    const nativeDetail =
      'native rejected https://sensitive.example/?appkey=sensitive-app-key';
    mockedCommon.preInit.mockRejectedValueOnce(new Error(nativeDetail));
    render(<Probe />, { wrapper: Harness });
    act(() => {
      current().actions.updateCredential('appkey', sensitiveCredentials.appkey);
    });

    await act(async () => {
      await current().actions.preInitialize();
    });

    expect(current().state.setup).toMatchObject({
      phase: 'editing',
      configSnapshot: null,
      feedback: {
        code: 'E_NON_UMENG',
        message: '发生未识别错误，请稍后重试',
      },
    });
    expect(JSON.stringify(current().state.logs)).not.toContain(
      sensitiveCredentials.appkey
    );
    expect(JSON.stringify(current().state.logs)).not.toContain(nativeDetail);
  });

  it('stores a frozen config snapshot, clears the displayed secret, and locks editing', async () => {
    render(<Probe />, { wrapper: Harness });
    act(() => {
      current().actions.updateCredential('appkey', sensitiveCredentials.appkey);
      current().actions.updateCredential('wechatEnabled', true);
      current().actions.updateCredential(
        'wechatAppId',
        sensitiveCredentials.wechatAppId
      );
      current().actions.updateCredential(
        'wechatAppSecret',
        sensitiveCredentials.wechatAppSecret
      );
      current().actions.updateCredential(
        'wechatUniversalLink',
        sensitiveCredentials.wechatUniversalLink
      );
      current().actions.updateCredential('dingtalkEnabled', true);
      current().actions.updateCredential(
        'dingtalkAppId',
        sensitiveCredentials.dingtalkAppId
      );
    });

    await act(async () => {
      await current().actions.preInitialize();
    });

    const calledConfig = mockedCommon.preInit.mock.calls[0]?.[0];
    expect(calledConfig).toEqual({
      appkey: sensitiveCredentials.appkey,
      wechatAppId: sensitiveCredentials.wechatAppId,
      wechatAppSecret: sensitiveCredentials.wechatAppSecret,
      wechatUniversalLink: sensitiveCredentials.wechatUniversalLink,
      dingtalkAppId: sensitiveCredentials.dingtalkAppId,
    });
    expect(Object.isFrozen(calledConfig)).toBe(true);
    expect(current().state.setup).toMatchObject({
      phase: 'awaitingConsent',
      consent: false,
      draft: { wechatAppSecret: '' },
    });
    expect(current().state.setup.configSnapshot).toBe(calledConfig);

    act(() => {
      current().actions.updateCredential('appkey', 'replacement-app-key');
    });
    expect(current().state.setup.draft.appkey).toBe(
      sensitiveCredentials.appkey
    );

    const serializedLogs = JSON.stringify(current().state.logs);
    for (const value of Object.values(sensitiveCredentials)) {
      expect(serializedLogs).not.toContain(value);
    }
  });

  it('requires explicit consent and calls init with no arguments', async () => {
    render(<Probe />, { wrapper: Harness });
    await enterAwaitingConsent();

    await act(async () => {
      await current().actions.initialize();
    });
    expect(mockedCommon.init).not.toHaveBeenCalled();
    expect(current().state.setup.phase).toBe('awaitingConsent');

    act(() => {
      current().actions.setConsent(true);
    });
    await act(async () => {
      await current().actions.initialize();
    });

    expect(mockedCommon.init.mock.calls).toEqual([[]]);
    expect(mockedCommon.isInited.mock.calls).toEqual([[]]);
    expect(current().state.setup.phase).toBe('initialized');
    expect(current().state.navigation.stack).toEqual(['home']);
  });

  it('keeps the same locked snapshot when init rejects and retries no-arg init', async () => {
    const nativeDetail =
      'vendor failure for sensitive-app-key and sensitive-wechat-secret';
    mockedCommon.init.mockRejectedValueOnce(new Error(nativeDetail));
    render(<Probe />, { wrapper: Harness });
    await enterAwaitingConsent();
    const snapshot = current().state.setup.configSnapshot;
    act(() => {
      current().actions.setConsent(true);
    });

    await act(async () => {
      await current().actions.initialize();
    });
    expect(current().state.setup).toMatchObject({
      phase: 'initFailedLocked',
      configSnapshot: snapshot,
      feedback: {
        code: 'E_NON_UMENG',
        restartRequired: true,
      },
    });
    expect(current().state.navigation.stack).toEqual(['setup']);

    await act(async () => {
      await current().actions.retryInitialize();
    });

    expect(mockedCommon.preInit).toHaveBeenCalledTimes(1);
    expect(mockedCommon.init.mock.calls).toEqual([[], []]);
    expect(current().state.setup.configSnapshot).toBe(snapshot);
    expect(current().state.setup.phase).toBe('initialized');
    expect(JSON.stringify(current().state.logs)).not.toContain(nativeDetail);
  });

  it('does not claim initialization when the public status query is false', async () => {
    mockedCommon.isInited.mockResolvedValueOnce(false);
    render(<Probe />, { wrapper: Harness });
    await enterAwaitingConsent();
    act(() => {
      current().actions.setConsent(true);
    });

    await act(async () => {
      await current().actions.initialize();
    });

    expect(mockedCommon.init.mock.calls).toEqual([[]]);
    expect(mockedCommon.isInited.mock.calls).toEqual([[]]);
    expect(current().state.setup).toMatchObject({
      phase: 'initFailedLocked',
      feedback: {
        code: 'E_NON_UMENG',
        restartRequired: true,
      },
    });
  });
});

describe('ShowcaseProvider platform operations', () => {
  it('returns from every Share action before initialization without touching Share', async () => {
    render(<Probe />, { wrapper: Harness });
    const sheetDraft: SheetDraft = {
      type: 'text',
      ...validDraft,
      options: sheetOptions,
    };

    await act(async () => {
      await current().actions.refreshPlatforms();
      await current().actions.checkPlatform(Platform.WECHAT_SESSION);
      await current().actions.openShareSheet(sheetDraft);
      await current().actions.shareDirect(
        'text',
        Platform.WECHAT_SESSION,
        validDraft
      );
    });

    expect(mockedShare.listPlatforms).not.toHaveBeenCalled();
    expect(mockedShare.isInstalled).not.toHaveBeenCalled();
    expect(mockedShare.openSheet).not.toHaveBeenCalled();
    expect(mockedShare.shareText).not.toHaveBeenCalled();
    expect(mockedShare.shareImage).not.toHaveBeenCalled();
    expect(mockedShare.shareLink).not.toHaveBeenCalled();
  });

  it('automatically stores platforms in supported order and retains them after refresh failure', async () => {
    const nativeDetail =
      'platform query failed for https://sensitive.example/full-url';
    mockedShare.listPlatforms.mockResolvedValueOnce([
      {
        platform: Platform.DINGTALK,
        installed: false,
        displayName: '钉钉',
      },
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
      },
    ]);
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();

    expect(mockedShare.listPlatforms).toHaveBeenCalledTimes(1);
    expect(current().state.platforms.items).toEqual([
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
      },
      {
        platform: Platform.DINGTALK,
        installed: false,
        displayName: '钉钉',
      },
    ]);
    const previousItems = current().state.platforms.items;
    mockedShare.listPlatforms.mockRejectedValueOnce(
      new UmengError('E_UNKNOWN', nativeDetail)
    );

    await act(async () => {
      await current().actions.refreshPlatforms();
    });

    expect(current().state.setup.phase).toBe('initialized');
    expect(current().state.platforms.items).toBe(previousItems);
    expect(current().state.platforms.feedback?.code).toBe('E_UNKNOWN');
    expect(current().state.feedback?.code).toBe('E_UNKNOWN');
    expect(JSON.stringify(current().state.logs)).not.toContain(nativeDetail);
  });

  it('updates only the selected platform after a single-platform check', async () => {
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();
    const previousItems = current().state.platforms.items;
    mockedShare.isInstalled.mockResolvedValueOnce(false);

    await act(async () => {
      await current().actions.checkPlatform(Platform.DINGTALK);
    });

    expect(mockedShare.isInstalled).toHaveBeenCalledWith(Platform.DINGTALK);
    expect(current().state.platforms.items).toEqual([
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
      },
      {
        platform: Platform.DINGTALK,
        installed: false,
        displayName: '钉钉',
      },
    ]);
    expect(current().state.platforms.items[0]).toBe(previousItems[0]);
  });
});

describe('ShowcaseProvider share operations', () => {
  it.each([
    [
      'text',
      Platform.WECHAT_SESSION,
      'shareText',
      {
        platform: Platform.WECHAT_SESSION,
        text: 'sensitive share body',
      },
    ],
    [
      'text',
      Platform.DINGTALK,
      'shareText',
      {
        platform: Platform.DINGTALK,
        text: 'sensitive share body',
      },
    ],
    [
      'image',
      Platform.WECHAT_SESSION,
      'shareImage',
      {
        platform: Platform.WECHAT_SESSION,
        image: 'https://sensitive.example/image.png',
        thumb: 'https://sensitive.example/thumb.png',
      },
    ],
    [
      'image',
      Platform.DINGTALK,
      'shareImage',
      {
        platform: Platform.DINGTALK,
        image: 'https://sensitive.example/image.png',
        thumb: 'https://sensitive.example/thumb.png',
      },
    ],
    [
      'link',
      Platform.WECHAT_SESSION,
      'shareLink',
      {
        platform: Platform.WECHAT_SESSION,
        title: 'sensitive share title',
        url: 'https://sensitive.example/page?credential=value',
        description: 'sensitive share description',
        thumb: 'https://sensitive.example/thumb.png',
      },
    ],
    [
      'link',
      Platform.DINGTALK,
      'shareLink',
      {
        platform: Platform.DINGTALK,
        title: 'sensitive share title',
        url: 'https://sensitive.example/page?credential=value',
        description: 'sensitive share description',
        thumb: 'https://sensitive.example/thumb.png',
      },
    ],
  ] as const)(
    'routes %s direct share for %s to the matching public API',
    async (type, platform, method, expectedOptions) => {
      render(<Probe />, { wrapper: Harness });
      await enterInitialized();

      await act(async () => {
        await current().actions.shareDirect(type, platform, validDraft);
      });

      expect(mockedShare[method]).toHaveBeenCalledWith(expectedOptions);
      expect(mockedShare.isInstalled).not.toHaveBeenCalled();
      expect(current().state.feedback).toBeNull();
      expect(current().state.logs[0]?.message).toBe(`success@${platform}`);
      const serializedLogs = JSON.stringify(current().state.logs);
      for (const value of Object.values(validDraft)) {
        expect(serializedLogs).not.toContain(value);
      }
    }
  );

  it('blocks a known uninstalled platform without rechecking or sharing', async () => {
    mockedShare.listPlatforms.mockResolvedValueOnce([
      {
        platform: Platform.WECHAT_SESSION,
        installed: false,
        displayName: '微信',
      },
      {
        platform: Platform.DINGTALK,
        installed: true,
        displayName: '钉钉',
      },
    ]);
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();

    await act(async () => {
      await current().actions.shareDirect(
        'text',
        Platform.WECHAT_SESSION,
        validDraft
      );
    });

    expect(mockedShare.isInstalled).not.toHaveBeenCalled();
    expect(mockedShare.shareText).not.toHaveBeenCalled();
    expect(current().state.feedback).toMatchObject({
      tone: 'warning',
      code: 'E_PLATFORM_NOT_INSTALLED',
    });
  });

  it('checks an unknown platform and shares only after a true result', async () => {
    mockedShare.listPlatforms.mockResolvedValueOnce([]);
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();

    await act(async () => {
      await current().actions.shareDirect(
        'text',
        Platform.DINGTALK,
        validDraft
      );
    });

    expect(mockedShare.isInstalled).toHaveBeenCalledWith(Platform.DINGTALK);
    expect(mockedShare.shareText).toHaveBeenCalledWith({
      platform: Platform.DINGTALK,
      text: 'sensitive share body',
    });
    expect(current().state.platforms.items).toEqual([
      {
        platform: Platform.DINGTALK,
        installed: true,
        displayName: '钉钉',
      },
    ]);
  });

  it('keeps an unknown platform unknown when installation query fails', async () => {
    const nativeDetail =
      'query leaked https://sensitive.example/page?credential=value';
    mockedShare.listPlatforms.mockResolvedValueOnce([]);
    mockedShare.isInstalled.mockRejectedValueOnce(
      new UmengError('E_UNKNOWN', nativeDetail)
    );
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();

    await act(async () => {
      await current().actions.shareDirect(
        'link',
        Platform.WECHAT_SESSION,
        validDraft
      );
    });

    expect(mockedShare.shareLink).not.toHaveBeenCalled();
    expect(current().state.platforms.items).toEqual([]);
    expect(current().state.platforms.feedback?.code).toBe('E_UNKNOWN');
    expect(current().state.feedback?.code).toBe('E_UNKNOWN');
    const serializedLogs = JSON.stringify(current().state.logs);
    expect(serializedLogs).not.toContain(nativeDetail);
    for (const value of Object.values(validDraft)) {
      expect(serializedLogs).not.toContain(value);
    }
  });

  it.each([
    ['text', { type: 'text', text: 'sensitive share body' }],
    [
      'image',
      {
        type: 'image',
        image: 'https://sensitive.example/image.png',
        thumb: 'https://sensitive.example/thumb.png',
      },
    ],
    [
      'link',
      {
        type: 'link',
        title: 'sensitive share title',
        url: 'https://sensitive.example/page?credential=value',
        description: 'sensitive share description',
        thumb: 'https://sensitive.example/thumb.png',
      },
    ],
  ] as const)(
    'opens a %s sheet with the complete public payload and options',
    async (type, expectedPayload) => {
      render(<Probe />, { wrapper: Harness });
      await enterInitialized();
      const draft: SheetDraft = {
        type,
        ...validDraft,
        options: sheetOptions,
      };

      await act(async () => {
        await current().actions.openShareSheet(draft);
      });

      expect(mockedShare.openSheet).toHaveBeenCalledWith(expectedPayload, {
        title: 'sensitive sheet title',
        cancelText: 'sensitive cancel text',
        subtitles: {
          [Platform.WECHAT_SESSION]: 'sensitive WeChat subtitle',
          [Platform.DINGTALK]: 'sensitive DingTalk subtitle',
        },
        hideUninstalled: true,
      });
      expect(current().state.logs[0]?.message).toBe(
        `success@${Platform.WECHAT_SESSION}`
      );
      const serializedLogs = JSON.stringify(current().state.logs);
      for (const value of [
        ...Object.values(validDraft),
        ...Object.values(sheetOptions).filter(
          (option) => typeof option === 'string'
        ),
      ]) {
        expect(serializedLogs).not.toContain(value);
      }
    }
  );

  it('classifies a cancelled share as neutral without leaking content', async () => {
    mockedShare.shareLink.mockRejectedValueOnce(
      shareCancel(Platform.WECHAT_SESSION)
    );
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();

    await act(async () => {
      await current().actions.shareDirect(
        'link',
        Platform.WECHAT_SESSION,
        validDraft
      );
    });

    expect(current().state.feedback).toMatchObject({
      tone: 'neutral',
      code: 'E_USER_CANCEL',
    });
    const serializedLogs = JSON.stringify(current().state.logs);
    for (const value of Object.values(validDraft)) {
      expect(serializedLogs).not.toContain(value);
    }
  });

  it('classifies a failed share without logging the native message', async () => {
    const nativeDetail =
      'failed sensitive share body at https://sensitive.example/page';
    mockedShare.shareImage.mockRejectedValueOnce(
      shareFailed(Platform.DINGTALK, nativeDetail)
    );
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();

    await act(async () => {
      await current().actions.shareDirect(
        'image',
        Platform.DINGTALK,
        validDraft
      );
    });

    expect(current().state.feedback).toMatchObject({
      tone: 'error',
      code: 'E_SHARE_FAILED',
    });
    expect(JSON.stringify(current().state.logs)).not.toContain(nativeDetail);
  });
});

describe('ShowcaseProvider Analytics operations', () => {
  it('calls synchronous Analytics methods and records only JS invocation facts', async () => {
    render(<Probe />, { wrapper: Harness });
    await enterInitialized();

    act(() => {
      current().actions.trackEvent('sensitive-event-id', {
        source: 'sensitive-source',
        count: 7,
      });
      current().actions.signIn('sensitive-user-id', 'sensitive-provider');
      current().actions.signOut();
    });

    expect(mockedAnalytics.onEvent).toHaveBeenCalledWith('sensitive-event-id', {
      source: 'sensitive-source',
      count: 7,
    });
    expect(mockedAnalytics.signIn).toHaveBeenCalledWith(
      'sensitive-user-id',
      'sensitive-provider'
    );
    expect(mockedAnalytics.signOut.mock.calls).toEqual([[]]);
    expect(
      current()
        .state.logs.filter((log) => log.scope === 'analytics')
        .map((log) => log.message)
    ).toEqual([
      'JS 已调用 Analytics.signOut',
      'JS 已调用 Analytics.signIn',
      'JS 已调用 Analytics.onEvent',
    ]);
    const serializedLogs = JSON.stringify(current().state.logs);
    for (const sensitive of [
      'sensitive-event-id',
      'sensitive-source',
      'sensitive-user-id',
      'sensitive-provider',
    ]) {
      expect(serializedLogs).not.toContain(sensitive);
    }
  });

  it.each([
    [
      'onEvent',
      () =>
        mockedAnalytics.onEvent.mockImplementationOnce(() => {
          throw new UmengError(
            'E_INVALID_OPTIONS',
            'sensitive-event-id is invalid'
          );
        }),
      () =>
        current().actions.trackEvent('sensitive-event-id', {
          source: 'sensitive-source',
        }),
      'JS 已调用 Analytics.onEvent',
      'sensitive-event-id is invalid',
    ],
    [
      'signIn',
      () =>
        mockedAnalytics.signIn.mockImplementationOnce(() => {
          throw new UmengError(
            'E_INVALID_OPTIONS',
            'sensitive-user-id is invalid'
          );
        }),
      () => current().actions.signIn('sensitive-user-id', 'sensitive-provider'),
      'JS 已调用 Analytics.signIn',
      'sensitive-user-id is invalid',
    ],
    [
      'signOut',
      () =>
        mockedAnalytics.signOut.mockImplementationOnce(() => {
          throw new UmengError('E_UNKNOWN', 'sensitive sign-out native detail');
        }),
      () => current().actions.signOut(),
      'JS 已调用 Analytics.signOut',
      'sensitive sign-out native detail',
    ],
  ] as const)(
    'does not record %s success when the synchronous call throws',
    async (_method, arrangeFailure, invoke, successMessage, nativeDetail) => {
      render(<Probe />, { wrapper: Harness });
      await enterInitialized();
      arrangeFailure();

      act(() => {
        invoke();
      });

      expect(current().state.feedback).toEqual(
        expect.objectContaining({
          code: _method === 'signOut' ? 'E_UNKNOWN' : 'E_INVALID_OPTIONS',
        })
      );
      const serializedLogs = JSON.stringify(current().state.logs);
      expect(serializedLogs).not.toContain(successMessage);
      expect(serializedLogs).not.toContain(nativeDetail);
    }
  );
});
