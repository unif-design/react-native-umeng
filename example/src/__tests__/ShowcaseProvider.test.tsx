import { act, render } from '@testing-library/react-native';
import * as api from '@unif/react-native-umeng';
import { UmengError, type ShareResult } from '@unif/react-native-umeng';
import { shareSuccess } from '@unif/react-native-umeng/mock';
import { ShowcaseProvider } from '../state/ShowcaseProvider';
import { useShowcase, type ShowcaseContextValue } from '../state/useShowcase';
import { DEFAULT_SHARE_CONTENT } from '../content/shareContent';

let current: ShowcaseContextValue;
const sheetOpen = jest.fn();
function Probe() {
  current = useShowcase();
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((r, fail) => {
    resolve = r;
    reject = fail;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.initializeUmeng).mockResolvedValue(undefined);
  jest.mocked(api.isUmengInitialized).mockResolvedValue(true);
  jest.mocked(api.getShareTargets).mockResolvedValue([
    { target: 'wechat_session', label: '微信', installed: true },
    { target: 'dingtalk', label: '钉钉', installed: true },
  ]);
  jest
    .mocked(api.share)
    .mockImplementation(async (request) => shareSuccess(request.target));
  jest.mocked(api.useShareSheet).mockReturnValue([{ open: sheetOpen }, <></>]);
  render(
    <ShowcaseProvider>
      <Probe />
    </ShowcaseProvider>
  );
});
async function review() {
  act(() => current.actions.updateCredential('appkey', 'private-app-key'));
  await act(async () => current.actions.reviewConfiguration());
}
async function initialize() {
  await review();
  act(() => current.actions.setConsent(true));
  await act(async () => current.actions.initialize());
}
it('does not call SDK while editing/reviewing or before consent', async () => {
  await review();
  await act(async () => current.actions.initialize());
  expect(api.initializeUmeng).not.toHaveBeenCalled();
  expect(current.state.setup.phase).toBe('awaitingConsent');
});
it('keeps a failed initialization locked and retries explicitly with the original snapshot', async () => {
  jest
    .mocked(api.initializeUmeng)
    .mockRejectedValueOnce(
      new UmengError({ reason: 'sdk_failed', message: 'private-native-error' })
    );
  await initialize();
  expect(current.state.setup.phase).toBe('initFailedLocked');
  act(() => current.actions.updateCredential('appkey', 'replacement'));
  await act(async () => current.actions.retryInitialize());
  expect(api.initializeUmeng).toHaveBeenNthCalledWith(2, {
    appKey: 'private-app-key',
  });
  expect(current.state.setup.phase).toBe('initialized');
  const logs = JSON.stringify(current.state.logs);
  expect(logs).not.toContain('private-app-key');
  expect(logs).not.toContain('private-native-error');
});
it.each([
  [{ status: 'success', target: 'wechat_session' }, 'success'],
  [{ status: 'cancelled', target: 'wechat_session' }, 'feedback'],
  [
    {
      status: 'failed',
      target: 'wechat_session',
      error: { reason: 'invalid_response', message: 'private-vendor-result' },
    },
    'feedback',
  ],
] as const)(
  'displays the direct-share result without turning other states into success: %p',
  async (result, kind) => {
    await initialize();
    jest.mocked(api.share).mockResolvedValueOnce(result);
    await act(async () =>
      current.actions.shareDirect('text', 'wechat_session', {
        ...DEFAULT_SHARE_CONTENT,
        text: 'private-body',
      })
    );
    expect(api.share).toHaveBeenCalledWith({
      target: 'wechat_session',
      content: { type: 'text', text: 'private-body' },
    });
    expect(current.state.results.direct?.kind).toBe(kind);
    expect(JSON.stringify(current.state.logs)).not.toMatch(
      /private-body|private-vendor-result/
    );
  }
);
it('does not let an older share overwrite the latest visible result', async () => {
  await initialize();
  const old = deferred<ShareResult>();
  jest
    .mocked(api.share)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({
      status: 'failed',
      error: { reason: 'busy', message: 'busy' },
    });
  let first!: Promise<void>;
  await act(async () => {
    first = current.actions.shareDirect(
      'text',
      'wechat_session',
      DEFAULT_SHARE_CONTENT
    );
  });
  await act(async () =>
    current.actions.shareDirect('text', 'wechat_session', DEFAULT_SHARE_CONTENT)
  );
  await act(async () => {
    old.resolve({ status: 'success', target: 'wechat_session' });
    await first;
  });
  expect(current.state.results.direct).toMatchObject({
    kind: 'feedback',
    feedback: { code: 'busy' },
  });
});
it('passes sheet options to its instance and accepts selection cancellation without a target', async () => {
  await initialize();
  sheetOpen.mockResolvedValueOnce({ status: 'cancelled' });
  await act(async () =>
    current.actions.openShareSheet({
      ...DEFAULT_SHARE_CONTENT,
      type: 'text',
      options: {
        title: '选择平台',
        cancelText: '取消',
        wechatSubtitle: '好友',
        dingtalkSubtitle: '同事',
        hideUninstalled: false,
        presentation: 'floating',
      },
    })
  );
  expect(sheetOpen).toHaveBeenCalledWith(
    { type: 'text', text: DEFAULT_SHARE_CONTENT.text },
    {
      title: '选择平台',
      cancelText: '取消',
      subtitles: { wechat_session: '好友', dingtalk: '同事' },
      hideUninstalled: false,
      presentation: 'floating',
    }
  );
  expect(current.state.results.sheet).toMatchObject({
    kind: 'feedback',
    feedback: { code: 'cancelled' },
  });
});
it('keeps synchronous analytics and actual user association calls separate from initialization', async () => {
  await initialize();
  act(() => {
    current.actions.trackEvent('event', { count: 2 });
    current.actions.signIn('user', 'org');
    current.actions.signOut();
  });
  expect(api.trackEvent).toHaveBeenCalledWith({
    name: 'event',
    attributes: { count: 2 },
  });
  expect(api.bindAnalyticsUser).toHaveBeenCalledWith({
    userId: 'user',
    provider: 'org',
  });
  expect(api.clearAnalyticsUser).toHaveBeenCalledTimes(1);
  expect(api.initializeUmeng).toHaveBeenCalledTimes(1);
});

it('keeps operations inert before initialization and clears safe diagnostic logs', async () => {
  await act(async () => {
    current.actions.navigate('home');
    current.actions.back();
    await current.actions.refreshPlatforms();
    await current.actions.checkPlatform('dingtalk');
    await current.actions.retryInitialize();
    await current.actions.initialize();
    await current.actions.shareDirect(
      'text',
      'dingtalk',
      DEFAULT_SHARE_CONTENT
    );
    await current.actions.openShareSheet(sheetDraft());
    current.actions.trackEvent('ignored');
    current.actions.signIn('ignored');
    current.actions.signOut();
    await current.actions.reviewConfiguration();
  });
  expect(api.initializeUmeng).not.toHaveBeenCalled();
  expect(api.getShareTargets).not.toHaveBeenCalled();
  expect(api.share).not.toHaveBeenCalled();
  expect(api.trackEvent).not.toHaveBeenCalled();
  expect(current.state.setup.errors.appkey).toBeTruthy();
  expect(current.state.logs[0]?.level).toBe('warning');
  act(() => current.actions.clearLogs());
  expect(current.state.logs).toEqual([]);
});
function sheetDraft() {
  return {
    ...DEFAULT_SHARE_CONTENT,
    type: 'text' as const,
    options: {
      title: '选择平台',
      cancelText: '取消',
      wechatSubtitle: '好友',
      dingtalkSubtitle: '同事',
      hideUninstalled: false,
      presentation: 'modal' as const,
    },
  };
}

it('locks reviewed vendor credentials, ignores repeated review and reports a false initialization status', async () => {
  act(() => {
    current.actions.updateCredential('appkey', 'key');
    current.actions.updateCredential('wechatEnabled', true);
    current.actions.updateCredential('wechatAppId', 'wx');
    current.actions.updateCredential('wechatAppSecret', 'secret');
    current.actions.updateCredential(
      'wechatUniversalLink',
      'https://example.com/link'
    );
    current.actions.updateCredential('dingtalkEnabled', true);
    current.actions.updateCredential('dingtalkAppId', 'ding');
  });
  await act(async () => current.actions.reviewConfiguration());
  const snapshot = current.state.setup.configSnapshot;
  await act(async () => current.actions.reviewConfiguration());
  expect(current.state.setup.configSnapshot).toBe(snapshot);
  expect(current.state.logs[0]?.message).toContain('微信已配置；钉钉已配置');
  jest.mocked(api.isUmengInitialized).mockResolvedValueOnce(false);
  act(() => current.actions.setConsent(true));
  await act(async () => current.actions.initialize());
  expect(current.state.setup.phase).toBe('initFailedLocked');
  expect(current.state.setup.feedback?.code).toBe('unrecognized');
  await act(async () => current.actions.retryInitialize());
  expect(current.state.setup.phase).toBe('initialized');
  act(() => current.actions.navigate('setup'));
  expect(current.state.navigation.stack).toEqual(['home']);
});

it('keeps newer refresh data when older queries complete or reject', async () => {
  await initialize();
  for (const outcome of ['success', 'failure']) {
    const previous = deferred<readonly api.ShareTargetInfo[]>();
    jest.mocked(api.getShareTargets).mockReturnValueOnce(previous.promise);
    let pending!: Promise<void>;
    await act(async () => {
      pending = current.actions.refreshPlatforms();
    });
    await act(async () => current.actions.refreshPlatforms());
    const state = current.state.platforms;
    await act(async () => {
      if (outcome === 'success') previous.resolve([]);
      else previous.reject(new Error('old failure'));
      await pending;
    });
    expect(current.state.platforms).toBe(state);
  }
  jest
    .mocked(api.getShareTargets)
    .mockRejectedValueOnce(
      new UmengError({ reason: 'not_installed', message: 'private' })
    );
  await act(async () => current.actions.refreshPlatforms());
  expect(
    current.state.platforms.items.every((item) => item.freshness === 'stale')
  ).toBe(true);
  expect(current.state.platforms.feedback?.tone).toBe('warning');
});

it('checks absent, uninstalled and rejected targets and ignores superseded query results', async () => {
  await initialize();
  jest.mocked(api.getShareTargets).mockResolvedValueOnce([]);
  await act(async () => current.actions.checkPlatform('wechat_session'));
  expect(current.state.platforms.feedback?.code).toBe('not_initialized');
  jest
    .mocked(api.getShareTargets)
    .mockResolvedValueOnce([
      { target: 'wechat_session', label: '微信', installed: false },
    ]);
  await act(async () => current.actions.checkPlatform('wechat_session'));
  expect(
    current.state.platforms.items.find(
      (item) => item.target === 'wechat_session'
    )?.installed
  ).toBe(false);
  for (const outcome of ['success', 'failure']) {
    const previous = deferred<readonly api.ShareTargetInfo[]>();
    jest.mocked(api.getShareTargets).mockReturnValueOnce(previous.promise);
    let pending!: Promise<void>;
    await act(async () => {
      pending = current.actions.checkPlatform('dingtalk');
    });
    await act(async () => current.actions.checkPlatform('dingtalk'));
    const state = current.state.platforms;
    await act(async () => {
      if (outcome === 'success')
        previous.resolve([
          { target: 'dingtalk', label: '钉钉', installed: false },
        ]);
      else previous.reject(new Error('old failure'));
      await pending;
    });
    expect(current.state.platforms).toBe(state);
  }
});

it('rechecks stale targets before sharing and reports installation and query failures', async () => {
  await initialize();
  jest
    .mocked(api.getShareTargets)
    .mockRejectedValueOnce(new Error('refresh failed'));
  await act(async () => current.actions.refreshPlatforms());
  await act(async () =>
    current.actions.shareDirect('text', 'dingtalk', DEFAULT_SHARE_CONTENT)
  );
  expect(api.share).toHaveBeenCalledTimes(1);
  jest
    .mocked(api.getShareTargets)
    .mockResolvedValueOnce([
      { target: 'dingtalk', label: '钉钉', installed: false },
    ]);
  await act(async () => current.actions.refreshPlatforms());
  await act(async () =>
    current.actions.shareDirect('text', 'dingtalk', DEFAULT_SHARE_CONTENT)
  );
  expect(current.state.results.direct).toMatchObject({
    kind: 'feedback',
    feedback: { code: 'not_installed' },
  });
  expect(api.share).toHaveBeenCalledTimes(1);
  jest
    .mocked(api.getShareTargets)
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error('query failed'));
  await act(async () => current.actions.refreshPlatforms());
  await act(async () =>
    current.actions.shareDirect('text', 'wechat_session', DEFAULT_SHARE_CONTENT)
  );
  expect(current.state.results.direct).toMatchObject({
    kind: 'feedback',
    feedback: { code: 'unrecognized' },
  });
});

it('ignores a direct-share preflight superseded by either another share or an independent check', async () => {
  await initialize();
  for (const replacement of ['share', 'check']) {
    jest.mocked(api.getShareTargets).mockResolvedValueOnce([]);
    await act(async () => current.actions.refreshPlatforms());
    const previous = deferred<readonly api.ShareTargetInfo[]>();
    jest.mocked(api.getShareTargets).mockReturnValueOnce(previous.promise);
    let pending!: Promise<void>;
    await act(async () => {
      pending = current.actions.shareDirect(
        'text',
        'dingtalk',
        DEFAULT_SHARE_CONTENT
      );
    });
    await act(async () => {
      if (replacement === 'share')
        await current.actions.shareDirect(
          'text',
          'dingtalk',
          DEFAULT_SHARE_CONTENT
        );
      else await current.actions.checkPlatform('dingtalk');
    });
    const count = jest.mocked(api.share).mock.calls.length;
    await act(async () => {
      previous.resolve([
        { target: 'dingtalk', label: '钉钉', installed: true },
      ]);
      await pending;
    });
    expect(api.share).toHaveBeenCalledTimes(count);
  }
});

it('records thrown share errors and ignores old cancellation/error receipts', async () => {
  await initialize();
  jest.mocked(api.share).mockRejectedValueOnce(new Error('private throw'));
  await act(async () =>
    current.actions.shareDirect('text', 'wechat_session', DEFAULT_SHARE_CONTENT)
  );
  expect(current.state.results.direct).toMatchObject({
    kind: 'feedback',
    feedback: { code: 'unrecognized' },
  });
  const old = deferred<ShareResult>();
  jest.mocked(api.share).mockReturnValueOnce(old.promise);
  let pending!: Promise<void>;
  await act(async () => {
    pending = current.actions.shareDirect(
      'text',
      'wechat_session',
      DEFAULT_SHARE_CONTENT
    );
  });
  await act(async () =>
    current.actions.shareDirect('text', 'wechat_session', DEFAULT_SHARE_CONTENT)
  );
  const visible = current.state.results.direct;
  await act(async () => {
    old.resolve({ status: 'cancelled' });
    await pending;
  });
  expect(current.state.results.direct).toBe(visible);
});

it('handles sheet success, failure, exceptions and an old completion without conflating receipts', async () => {
  await initialize();
  for (const outcome of ['success', 'failure', 'throw']) {
    if (outcome === 'success')
      sheetOpen.mockResolvedValueOnce({
        status: 'success',
        target: 'dingtalk',
      });
    else if (outcome === 'failure')
      sheetOpen.mockResolvedValueOnce({
        status: 'failed',
        error: { reason: 'sdk_failed', message: 'private' },
      });
    else sheetOpen.mockRejectedValueOnce(new Error('private'));
    await act(async () => current.actions.openShareSheet(sheetDraft()));
    expect(current.state.results.sheet?.kind).toBe(
      outcome === 'success' ? 'success' : 'feedback'
    );
  }
  const old = deferred<ShareResult>();
  sheetOpen
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ status: 'cancelled' });
  let pending!: Promise<void>;
  await act(async () => {
    pending = current.actions.openShareSheet(sheetDraft());
  });
  await act(async () => current.actions.openShareSheet(sheetDraft()));
  const visible = current.state.results.sheet;
  await act(async () => {
    old.resolve({ status: 'success', target: 'dingtalk' });
    await pending;
  });
  expect(current.state.results.sheet).toBe(visible);
});

it('records synchronous analytics failures and preserves a reentrant later analytics operation', async () => {
  await initialize();
  jest.mocked(api.trackEvent).mockImplementationOnce(() => {
    throw new Error('private');
  });
  act(() => current.actions.trackEvent('fail'));
  expect(current.state.results.analytics).toMatchObject({
    kind: 'feedback',
    feedback: { code: 'unrecognized' },
  });
  for (const shouldThrow of [false, true]) {
    jest.mocked(api.trackEvent).mockImplementationOnce(() => {
      current.actions.signOut();
      if (shouldThrow) throw new Error('old failure');
    });
    act(() => current.actions.trackEvent('reentrant'));
    expect(current.state.results.analytics).toEqual({
      kind: 'success',
      message: 'JS 已调用 clearAnalyticsUser',
    });
  }
});

it('accepts Android configuration without an iOS Universal Link', async () => {
  const { Platform } = require('react-native');
  const original = Platform.OS;
  Platform.OS = 'android';
  try {
    act(() => {
      current.actions.updateCredential('appkey', 'android-app-key');
      current.actions.updateCredential('wechatEnabled', true);
      current.actions.updateCredential('wechatAppId', 'wechat-app');
      current.actions.updateCredential('wechatAppSecret', 'wechat-secret');
    });
    await act(async () => current.actions.reviewConfiguration());
    expect(current.state.setup.phase).toBe('awaitingConsent');
    expect(
      current.state.setup.configSnapshot?.wechat?.universalLink
    ).toBeUndefined();
  } finally {
    Platform.OS = original;
  }
});
