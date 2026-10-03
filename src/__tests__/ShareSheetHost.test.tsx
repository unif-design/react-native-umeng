jest.mock('@unif/react-native-design', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  const colors = {
    surfaceContainer: '#f0f0f0',
    surface: '#fff',
    scrim: 'rgba(0,0,0,0.5)',
    foreground: '#111',
  };
  return {
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => ({ scheme: 'light', colors, shadow: {} }),
    // 组件用 useThemedStyles(maker)：用 mock 色板调真实 makeStyles，产出真实 StyleSheet。
    useThemedStyles: (maker: any) => maker(colors, {}),
    Cell: ({ title, desc, onPress, disabled, testID }: any) => {
      const pressableProps: Record<string, unknown> = { testID, onPress };
      if (disabled !== undefined) {
        pressableProps.disabled = disabled;
        pressableProps.accessibilityState = { disabled };
      }
      return React.createElement(
        TouchableOpacity,
        pressableProps,
        React.createElement(Text, null, title),
        desc && React.createElement(Text, null, desc)
      );
    },
    Button: ({ label, onPress, testID }: any) =>
      React.createElement(
        TouchableOpacity,
        { testID, onPress },
        React.createElement(Text, null, label)
      ),
  };
});
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});
jest.mock('../NativeUmengCommon', () => ({
  __esModule: true,
  default: {
    getConfiguredShareTargets: jest
      .fn()
      .mockResolvedValue(['wechat_session', 'dingtalk']),
  },
}));
jest.mock('../NativeUmengShare', () => ({
  __esModule: true,
  default: {
    isInstalled: jest.fn(),
    shareText: jest.fn(),
    shareImage: jest.fn(),
    shareLink: jest.fn(),
  },
}));

import { render, act, fireEvent, waitFor } from '@testing-library/react-native';
import { Modal, View } from 'react-native';
import {
  useShareSheet,
  type ShareSheetController,
  type ShareResult,
} from '../index';
import Native from '../NativeUmengShare';
import { deferred } from './fixtures/deferred';

let controller: ShareSheetController;
function Harness({ host = true }: { host?: boolean }) {
  const [sheet, element] = useShareSheet();
  controller = sheet;
  return host ? element : null;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Native!.isInstalled).mockResolvedValue(true);
  jest
    .mocked(Native!.shareText)
    .mockResolvedValue({ code: 'success', platform: 'wechat_session' });
});

it('renders options, queries actual targets, and uses the same share operation', async () => {
  const screen = render(<Harness />);
  const onLayout = jest.fn();
  const input = { type: 'text' as const, text: 'original' };
  let pending!: Promise<ShareResult>;
  await act(async () => {
    pending = controller.open(input, {
      title: '发送给同事',
      subtitles: { dingtalk: '工作群' },
      onLayout,
    });
  });
  input.text = 'changed';
  expect(screen.getByText('发送给同事')).toBeTruthy();
  expect(screen.getByText('工作群 · 已安装')).toBeTruthy();
  fireEvent(screen.getByTestId('umeng-share-sheet'), 'layout', {
    nativeEvent: { layout: { height: 250 } },
  });
  expect(onLayout).toHaveBeenCalledWith(250);
  await act(async () => {
    fireEvent.press(screen.getByTestId('umeng-share-cell-wechat_session'));
  });
  await expect(pending).resolves.toEqual({
    status: 'success',
    target: 'wechat_session',
  });
  expect(Native!.shareText).toHaveBeenCalledWith('wechat_session', 'original');
});

it('keeps the controller stable and requires this instance host', async () => {
  const screen = render(<Harness host={false} />);
  const first = controller;
  await expect(
    first.open({ type: 'text', text: 'hello' })
  ).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unavailable' },
  });
  screen.rerender(<Harness />);
  expect(controller).toBe(first);
  let pending!: Promise<ShareResult>;
  await act(async () => {
    pending = first.open({ type: 'text', text: 'hello' });
  });
  await expect(
    first.open({ type: 'text', text: 'again' })
  ).resolves.toMatchObject({ status: 'failed', error: { reason: 'busy' } });
  await act(async () => {
    fireEvent.press(screen.getByTestId('umeng-share-cancel'));
  });
  await expect(pending).resolves.toEqual({ status: 'cancelled' });
  expect(Native!.shareText).not.toHaveBeenCalled();
});

it('keeps floating presentation in its window and preserves SDK result after abort and unmount', async () => {
  const sdk = deferred<{ code: 'success'; platform: string }>();
  jest.mocked(Native!.shareText).mockReturnValueOnce(sdk.promise);
  const screen = render(<Harness />);
  const signal = new AbortController();
  const onDismiss = jest.fn();
  let pending!: Promise<ShareResult>;
  await act(async () => {
    pending = controller.open(
      { type: 'text', text: 'hello' },
      { presentation: 'floating', signal: signal.signal, onDismiss }
    );
  });
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  expect(
    screen.getByTestId('umeng-share-floating-root').props.pointerEvents
  ).toBe('box-none');
  await act(async () => {
    fireEvent.press(screen.getByTestId('umeng-share-cell-wechat_session'));
  });
  await waitFor(() => expect(Native!.shareText).toHaveBeenCalledTimes(1));
  signal.abort();
  screen.unmount();
  sdk.resolve({ code: 'success', platform: 'wechat_session' });
  await expect(pending).resolves.toEqual({
    status: 'success',
    target: 'wechat_session',
  });
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('uses native installed state and hides uninstalled entries only when requested', async () => {
  jest
    .mocked(Native!.isInstalled)
    .mockImplementation(async (target) => target !== 'dingtalk');
  const screen = render(<Harness />);
  let pending!: Promise<ShareResult>;
  await act(async () => {
    pending = controller.open(
      { type: 'text', text: 'hello' },
      { presentation: 'floating' }
    );
  });
  expect(screen.getByText('钉钉')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByTestId('umeng-share-cell-dingtalk'));
  });
  await expect(pending).resolves.toMatchObject({
    status: 'failed',
    target: 'dingtalk',
    error: { reason: 'not_installed' },
  });
  expect(Native!.shareText).not.toHaveBeenCalled();
  await act(async () => {
    pending = controller.open(
      { type: 'text', text: 'hello' },
      { hideUninstalled: true, presentation: 'floating' }
    );
  });
  expect(screen.queryByText('钉钉')).toBeNull();
  await act(async () => {
    fireEvent.press(screen.getByTestId('umeng-share-cancel'));
  });
  await pending;
});

it('cancels loading without letting a late query update the next presentation', async () => {
  const query = deferred<boolean>();
  jest.mocked(Native!.isInstalled).mockReturnValueOnce(query.promise);
  const screen = render(<Harness />);
  const abort = new AbortController();
  let first!: Promise<ShareResult>;
  await act(async () => {
    first = controller.open(
      { type: 'text', text: 'old' },
      { signal: abort.signal, title: '旧面板' }
    );
  });
  await act(async () => abort.abort());
  await expect(first).resolves.toEqual({ status: 'cancelled' });
  let second!: Promise<ShareResult>;
  await act(async () => {
    second = controller.open(
      { type: 'text', text: 'new' },
      { title: '新面板' }
    );
  });
  await act(async () => query.resolve(true));
  expect(screen.getByText('新面板')).toBeTruthy();
  expect(screen.queryByText('旧面板')).toBeNull();
  await act(async () =>
    fireEvent.press(screen.getByTestId('umeng-share-cancel'))
  );
  await second;
});

it('does not let an old layout or dismissal callback affect a new sheet', async () => {
  const screen = render(<Harness />);
  const oldLayout = jest.fn();
  let first!: Promise<ShareResult>;
  await act(async () => {
    first = controller.open(
      { type: 'text', text: 'old' },
      { onLayout: oldLayout }
    );
  });
  const oldModal = screen.UNSAFE_getByType(Modal).props;
  const oldSheet = screen.getByTestId('umeng-share-sheet').props;
  await act(async () => {
    oldModal.onShow();
    fireEvent.press(screen.getByTestId('umeng-share-cancel'));
  });
  await first;
  await act(async () => oldModal.onDismiss());
  let second!: Promise<ShareResult>;
  await act(async () => {
    second = controller.open(
      { type: 'text', text: 'new' },
      { title: 'New sheet' }
    );
  });
  await act(async () => {
    oldModal.onShow();
    oldModal.onDismiss();
    oldSheet.onLayout({ nativeEvent: { layout: { height: 999 } } });
  });
  expect(oldLayout).not.toHaveBeenCalled();
  expect(screen.getByText('New sheet')).toBeTruthy();
  await act(async () =>
    fireEvent.press(screen.getByTestId('umeng-share-cancel'))
  );
  await expect(second).resolves.toEqual({ status: 'cancelled' });
});

it('keeps a dismissal before onShow attached to its original native Modal', async () => {
  const screen = render(<Harness />);
  const abort = new AbortController();
  const firstDismissed = jest.fn();
  const rejectedReentryDismissed = jest.fn();
  let first!: Promise<ShareResult>;
  await act(async () => {
    first = controller.open(
      { type: 'text', text: 'first' },
      { signal: abort.signal, onDismiss: firstDismissed }
    );
  });
  const nativeModal = screen.UNSAFE_getByType(Modal);
  await act(async () => abort.abort());
  await expect(first).resolves.toEqual({ status: 'cancelled' });
  expect(firstDismissed).not.toHaveBeenCalled();
  expect(nativeModal.props.visible).toBe(true);

  let reentry!: Promise<ShareResult>;
  await act(async () => {
    reentry = controller.open(
      { type: 'text', text: 'reentry' },
      { onDismiss: rejectedReentryDismissed }
    );
  });
  // RN Modal reads its latest props when the native animation completes.
  // Retaining an old props object would miss the production race.
  await act(async () => nativeModal.props.onShow());
  expect(nativeModal.props.visible).toBe(false);
  await act(async () => nativeModal.props.onDismiss());
  expect(rejectedReentryDismissed).not.toHaveBeenCalled();
  expect(firstDismissed).toHaveBeenCalledTimes(1);
  await expect(reentry).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'busy' },
  });
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();

  const nextDismissed = jest.fn();
  let next!: Promise<ShareResult>;
  await act(async () => {
    next = controller.open(
      { type: 'text', text: 'next' },
      { onDismiss: nextDismissed }
    );
  });
  const nextModal = screen.UNSAFE_getByType(Modal);
  await act(async () => nextModal.props.onShow());
  await act(async () =>
    fireEvent.press(screen.getByTestId('umeng-share-cancel'))
  );
  await expect(next).resolves.toEqual({ status: 'cancelled' });
  await act(async () => nextModal.props.onDismiss());
  expect(nextDismissed).toHaveBeenCalledTimes(1);
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
});

it('cancels before a Modal commits without requiring native presentation events', async () => {
  const screen = render(<Harness />);
  const abort = new AbortController();
  const dismissed = jest.fn();
  let pending!: Promise<ShareResult>;
  await act(async () => {
    pending = controller.open(
      { type: 'text', text: 'never presented' },
      { signal: abort.signal, onDismiss: dismissed }
    );
    abort.abort();
    abort.abort();
  });
  await expect(pending).resolves.toEqual({ status: 'cancelled' });
  expect(dismissed).toHaveBeenCalledTimes(1);
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();

  const nextDismissed = jest.fn();
  await act(async () => {
    pending = controller.open(
      { type: 'text', text: 'next' },
      { onDismiss: nextDismissed }
    );
  });
  const nativeModal = screen.UNSAFE_getByType(Modal);
  await act(async () => nativeModal.props.onShow());
  const close = nativeModal.props.onRequestClose;
  await act(async () => {
    close();
    close();
  });
  await expect(pending).resolves.toEqual({ status: 'cancelled' });
  const didDismiss = nativeModal.props.onDismiss;
  await act(async () => {
    didDismiss();
    didDismiss();
  });
  expect(nextDismissed).toHaveBeenCalledTimes(1);
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
});

it.each(['opening', 'shown', 'closing'] as const)(
  'replaces an unmounted %s host without delivering its events to the replacement',
  async (phase) => {
    const screen = render(<Harness />);
    const originalController = controller;
    const dismissed = jest.fn();
    const resolved = jest.fn();
    const abort = new AbortController();
    let first!: Promise<ShareResult>;
    await act(async () => {
      first = controller.open(
        { type: 'text', text: 'old' },
        { signal: abort.signal, onDismiss: dismissed }
      );
      first.then(resolved);
    });
    const originalModal = screen.UNSAFE_getByType(Modal);
    if (phase !== 'opening')
      await act(async () => originalModal.props.onShow());
    if (phase === 'closing') await act(async () => abort.abort());
    const oldCallbacks = originalModal.props;
    screen.rerender(<Harness host={false} />);
    await expect(first).resolves.toEqual({ status: 'cancelled' });
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(resolved).toHaveBeenCalledTimes(1);

    screen.rerender(<Harness />);
    expect(controller).toBe(originalController);
    const nextDismissed = jest.fn();
    let next!: Promise<ShareResult>;
    await act(async () => {
      next = controller.open(
        { type: 'text', text: 'new' },
        { title: '新面板', onDismiss: nextDismissed }
      );
    });
    await act(async () => {
      oldCallbacks.onShow();
      oldCallbacks.onRequestClose();
      oldCallbacks.onDismiss();
      oldCallbacks.onDismiss();
      abort.abort();
    });
    expect(nextDismissed).not.toHaveBeenCalled();
    expect(screen.getByText('新面板')).toBeTruthy();
    const nextModal = screen.UNSAFE_getByType(Modal);
    await act(async () => nextModal.props.onShow());
    await act(async () => nextModal.props.onRequestClose());
    await expect(next).resolves.toEqual({ status: 'cancelled' });
    await act(async () => nextModal.props.onDismiss());
    expect(nextDismissed).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(resolved).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  }
);

it('keeps old native events isolated when the hook instance is replaced', async () => {
  const screen = render(
    <View>
      <Harness key="old" />
    </View>
  );
  const originalController = controller;
  const dismissed = jest.fn();
  let first!: Promise<ShareResult>;
  await act(async () => {
    first = controller.open(
      { type: 'text', text: 'old' },
      { onDismiss: dismissed }
    );
  });
  const oldCallbacks = screen.UNSAFE_getByType(Modal).props;
  screen.rerender(
    <View>
      <Harness key="new" />
    </View>
  );
  await expect(first).resolves.toEqual({ status: 'cancelled' });
  expect(dismissed).toHaveBeenCalledTimes(1);
  expect(controller).not.toBe(originalController);
  const nextDismissed = jest.fn();
  let next!: Promise<ShareResult>;
  await act(async () => {
    next = controller.open(
      { type: 'text', text: 'new' },
      { onDismiss: nextDismissed }
    );
  });
  await act(async () => {
    oldCallbacks.onShow();
    oldCallbacks.onRequestClose();
    oldCallbacks.onDismiss();
  });
  expect(nextDismissed).not.toHaveBeenCalled();
  const nextModal = screen.UNSAFE_getByType(Modal);
  await act(async () => nextModal.props.onShow());
  await act(async () => nextModal.props.onRequestClose());
  await expect(next).resolves.toEqual({ status: 'cancelled' });
  await act(async () => nextModal.props.onDismiss());
  expect(nextDismissed).toHaveBeenCalledTimes(1);
});

it('settles a native dismissal before selection exactly once', async () => {
  const screen = render(<Harness />);
  const dismissed = jest.fn();
  const resolved = jest.fn();
  let pending!: Promise<ShareResult>;
  await act(async () => {
    pending = controller.open(
      { type: 'text', text: 'hello' },
      { onDismiss: dismissed }
    );
    pending.then(resolved);
  });
  const nativeModal = screen.UNSAFE_getByType(Modal);
  await act(async () => nativeModal.props.onShow());
  const didDismiss = nativeModal.props.onDismiss;
  await act(async () => {
    didDismiss();
    didDismiss();
  });
  expect(resolved).toHaveBeenCalledTimes(1);
  await expect(pending).resolves.toEqual({ status: 'cancelled' });
  expect(dismissed).toHaveBeenCalledTimes(1);
  expect(Native!.shareText).not.toHaveBeenCalled();
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
});

it('releases the abort listener after dismissal while preserving the pending SDK receipt', async () => {
  const sdk = deferred<{ code: 'success'; platform: string }>();
  jest.mocked(Native!.shareText).mockReturnValueOnce(sdk.promise);
  const screen = render(<Harness />);
  const abort = new AbortController();
  const removeListener = jest.spyOn(abort.signal, 'removeEventListener');
  const dismissed = jest.fn();
  const resolved = jest.fn();
  let pending!: Promise<ShareResult>;
  await act(async () => {
    pending = controller.open(
      { type: 'text', text: 'hello' },
      { signal: abort.signal, onDismiss: dismissed }
    );
    pending.then(resolved);
  });
  const nativeModal = screen.UNSAFE_getByType(Modal);
  await act(async () => nativeModal.props.onShow());
  await act(async () =>
    fireEvent.press(screen.getByTestId('umeng-share-cell-wechat_session'))
  );
  await act(async () => nativeModal.props.onDismiss());
  expect(dismissed).toHaveBeenCalledTimes(1);
  expect(removeListener).toHaveBeenCalledTimes(1);
  expect(resolved).not.toHaveBeenCalled();
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  abort.abort();
  screen.unmount();
  sdk.resolve({ code: 'success', platform: 'wechat_session' });
  await expect(pending).resolves.toEqual({
    status: 'success',
    target: 'wechat_session',
  });
  expect(removeListener).toHaveBeenCalledTimes(1);
  expect(dismissed).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenCalledTimes(1);
});
