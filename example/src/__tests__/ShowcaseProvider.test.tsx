import { act, render } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';
import { Common } from '@unif/react-native-umeng';

import { ShowcaseProvider } from '../state/ShowcaseProvider';
import { useShowcase, type ShowcaseContextValue } from '../state/useShowcase';

jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);

const mockedCommon = jest.mocked(Common);
const sensitiveCredentials = {
  appkey: 'sensitive-app-key',
  wechatAppId: 'sensitive-wechat-app-id',
  wechatAppSecret: 'sensitive-wechat-secret',
  wechatUniversalLink: 'https://sensitive.example/universal-link',
  dingtalkAppId: 'sensitive-dingtalk-app-id',
} as const;

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

describe('ShowcaseProvider setup flow', () => {
  beforeEach(() => {
    currentContext = undefined;
    mockedCommon.preInit.mockResolvedValue(undefined);
    mockedCommon.init.mockResolvedValue(undefined);
    mockedCommon.isInited.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

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
