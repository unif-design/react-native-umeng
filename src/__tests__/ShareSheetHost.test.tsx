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
import { Modal } from 'react-native';
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
