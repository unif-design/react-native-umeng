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
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
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
