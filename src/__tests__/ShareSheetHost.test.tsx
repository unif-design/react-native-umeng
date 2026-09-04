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
jest.mock('../share', () => ({
  shareText: jest.fn(),
  shareImage: jest.fn(),
  shareLink: jest.fn(),
  isInstalled: jest.fn(),
  listPlatforms: jest.fn(),
}));

import {
  render,
  act,
  cleanupAsync,
  fireEvent,
} from '@testing-library/react-native';
import { Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ShareSheetHost } from '../ShareSheet/ShareSheetHost';
import { shareSheetController } from '../ShareSheet/ShareSheetController';
import {
  Platform,
  type PlatformInfo,
  type ShareResult,
  type ShareSheetOptions,
  type ShareSheetPayload,
} from '../types';
import * as Share from '../share';
import { deferred } from './fixtures/deferred';

const INSTALLED_PLATFORMS: PlatformInfo[] = [
  {
    platform: Platform.WECHAT_SESSION,
    installed: true,
    displayName: '微信',
  },
  { platform: Platform.DINGTALK, installed: true, displayName: '钉钉' },
];
const WECHAT_SUCCESS: ShareResult = {
  code: 'success',
  platform: Platform.WECHAT_SESSION,
};
const DINGTALK_SUCCESS: ShareResult = {
  code: 'success',
  platform: Platform.DINGTALK,
};
const TEXT_PAYLOAD: ShareSheetPayload = { type: 'text', text: 'hi' };

async function show(
  payload: ShareSheetPayload = TEXT_PAYLOAD,
  options?: ShareSheetOptions
): Promise<{ pending: Promise<ShareResult> }> {
  let promise!: Promise<ShareResult>;
  await act(async () => {
    promise = shareSheetController.show(payload, options);
    promise.catch(() => {});
    await Promise.resolve();
  });
  // async 函数会自动吸收直接返回的 Promise；包一层对象以保留 pending 状态。
  return { pending: promise };
}

function expectRejectsWith(
  promise: Promise<ShareResult>,
  expected: Record<string, unknown>
): Promise<void> {
  return promise.then(
    () => {
      throw new Error('Expected the ShareSheet promise to reject');
    },
    (error: unknown) => {
      expect(error).toMatchObject(expected);
    }
  );
}

function expectResolvesTo(
  promise: Promise<ShareResult>,
  expected: ShareResult
): Promise<void> {
  return promise.then((result) => {
    expect(result).toEqual(expected);
  });
}

describe('ShareSheetHost', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (Share.listPlatforms as jest.Mock).mockResolvedValue(INSTALLED_PLATFORMS);
  });

  afterEach(async () => {
    await cleanupAsync();
    await act(async () => {
      await Promise.resolve();
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('rejects when querying platforms fails instead of rendering every platform as uninstalled', async () => {
    const query = deferred<PlatformInfo[]>();
    (Share.listPlatforms as jest.Mock).mockReturnValue(query.promise);
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show();
    const rejection = expectRejectsWith(promise, {
      code: 'E_UNKNOWN',
      message: 'Failed to query installed share platforms',
    });

    await act(async () => {
      query.reject(null);
      await rejection;
    });

    expect(screen.queryByTestId('umeng-share-cell-wechat_session')).toBeNull();
    expect(screen.queryByTestId('umeng-share-cell-dingtalk')).toBeNull();
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
  });

  it('ignores session A platform results that arrive after session B is ready', async () => {
    const queryA = deferred<PlatformInfo[]>();
    const queryB = deferred<PlatformInfo[]>();
    (Share.listPlatforms as jest.Mock)
      .mockReturnValueOnce(queryA.promise)
      .mockReturnValueOnce(queryB.promise);
    const screen = render(<ShareSheetHost />);

    const { pending: sessionA } = await show();
    const sessionARejection = expectRejectsWith(sessionA, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
      await sessionARejection;
    });

    const { pending: sessionB } = await show();
    await act(async () => {
      queryB.resolve([
        {
          platform: Platform.DINGTALK,
          installed: true,
          displayName: '钉钉',
        },
      ]);
      await Promise.resolve();
    });
    expect(screen.queryByTestId('umeng-share-cell-dingtalk')).not.toBeNull();
    expect(screen.queryByTestId('umeng-share-cell-wechat_session')).toBeNull();

    await act(async () => {
      queryA.resolve([
        {
          platform: Platform.WECHAT_SESSION,
          installed: true,
          displayName: '微信',
        },
      ]);
      await Promise.resolve();
    });
    expect(screen.queryByTestId('umeng-share-cell-dingtalk')).not.toBeNull();
    expect(screen.queryByTestId('umeng-share-cell-wechat_session')).toBeNull();

    const sessionBRejection = expectRejectsWith(sessionB, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('umeng-share-cancel'));
      await sessionBRejection;
    });
  });

  it('uses the synchronous sharing transition to ignore a platform double press', async () => {
    const nativeShare = deferred<ShareResult>();
    (Share.shareText as jest.Mock).mockReturnValue(nativeShare.promise);
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show({
      type: 'text',
      text: 'double',
    });
    const cell = screen.getByTestId('umeng-share-cell-wechat_session');

    act(() => {
      fireEvent.press(cell);
      fireEvent.press(cell);
    });

    expect(Share.shareText).toHaveBeenCalledTimes(1);
    expect(Share.shareText).toHaveBeenCalledWith({
      platform: Platform.WECHAT_SESSION,
      text: 'double',
    });

    const resolution = expectResolvesTo(promise, WECHAT_SUCCESS);
    await act(async () => {
      nativeShare.resolve(WECHAT_SUCCESS);
      await resolution;
    });
  });

  it('closes the modal while sharing and accepts a cancellation callback', async () => {
    const nativeShare = deferred<ShareResult>();
    (Share.shareText as jest.Mock).mockReturnValue(nativeShare.promise);
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show();
    const modal = screen.UNSAFE_getByType(Modal);
    const backdrop = screen.getByLabelText('关闭');
    const cancel = screen.getByTestId('umeng-share-cancel');

    act(() => {
      fireEvent.press(screen.getByTestId('umeng-share-cell-wechat_session'));
    });
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);

    const rejection = expectRejectsWith(promise, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      modal.props.onRequestClose();
      fireEvent.press(cancel);
      fireEvent.press(backdrop);
      await rejection;
      nativeShare.resolve(WECHAT_SUCCESS);
      await Promise.resolve();
    });
  });

  it('renders floating presentation without a scrim and reports its height', async () => {
    const onSheetLayout = jest.fn();
    const onDismiss = jest.fn();
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show(TEXT_PAYLOAD, {
      presentation: 'floating',
      onSheetLayout,
      onDismiss,
    });

    expect(() => screen.UNSAFE_getByType(Modal)).toThrow();
    expect(screen.queryByLabelText('关闭')).toBeNull();
    expect(screen.getByTestId('umeng-share-floating-root')).toHaveProp(
      'pointerEvents',
      'box-none'
    );

    fireEvent(screen.getByTestId('umeng-share-sheet'), 'layout', {
      nativeEvent: {
        layout: { x: 0, y: 0, width: 390, height: 260 },
      },
    });
    expect(onSheetLayout).toHaveBeenCalledWith(260);

    const rejection = expectRejectsWith(promise, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('umeng-share-cancel'));
      await rejection;
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps floating controls available while native sharing is in flight', async () => {
    const nativeShare = deferred<ShareResult>();
    const onDismiss = jest.fn();
    (Share.shareText as jest.Mock).mockReturnValue(nativeShare.promise);
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show(TEXT_PAYLOAD, {
      presentation: 'floating',
      onDismiss,
    });

    act(() => {
      fireEvent.press(screen.getByTestId('umeng-share-cell-wechat_session'));
    });
    expect(screen.getByTestId('umeng-share-floating-root')).toBeTruthy();
    expect(screen.getByTestId('umeng-share-cancel')).toBeTruthy();

    const rejection = expectRejectsWith(promise, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('umeng-share-cancel'));
      await rejection;
      nativeShare.resolve(WECHAT_SUCCESS);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('umeng-share-floating-root')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fires modal onDismiss only after the native modal finishes closing', async () => {
    const onDismiss = jest.fn();
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show(TEXT_PAYLOAD, { onDismiss });
    act(() => {
      screen.UNSAFE_getByType(Modal).props.onShow();
    });

    const rejection = expectRejectsWith(promise, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('umeng-share-cancel'));
      await rejection;
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      screen.UNSAFE_getByType(Modal).props.onDismiss();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not let a late native result from unmounted session A settle session B', async () => {
    const nativeA = deferred<ShareResult>();
    (Share.shareText as jest.Mock)
      .mockReturnValueOnce(nativeA.promise)
      .mockResolvedValueOnce(DINGTALK_SUCCESS);
    const hostA = render(<ShareSheetHost />);
    const { pending: sessionA } = await show({ type: 'text', text: 'A' });
    act(() => {
      fireEvent.press(hostA.getByTestId('umeng-share-cell-wechat_session'));
    });
    const sessionARejection = expectRejectsWith(sessionA, {
      code: 'E_UNKNOWN',
      message:
        'The active <ShareSheetHost /> unmounted before the share completed.',
    });
    hostA.unmount();
    await sessionARejection;

    const hostB = render(<ShareSheetHost />);
    const { pending: sessionB } = await show({ type: 'text', text: 'B' });
    await act(async () => {
      nativeA.resolve(WECHAT_SUCCESS);
      await Promise.resolve();
    });

    expect(hostB.UNSAFE_getByType(Modal).props.visible).toBe(true);
    const sessionBResolution = expectResolvesTo(sessionB, DINGTALK_SUCCESS);
    await act(async () => {
      fireEvent.press(hostB.getByTestId('umeng-share-cell-dingtalk'));
      await sessionBResolution;
    });
    expect(Share.shareText).toHaveBeenNthCalledWith(2, {
      platform: Platform.DINGTALK,
      text: 'B',
    });
  });

  it('rejects the pending session when its owner Host unmounts', async () => {
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show();
    const rejection = expectRejectsWith(promise, {
      code: 'E_UNKNOWN',
      message:
        'The active <ShareSheetHost /> unmounted before the share completed.',
    });

    screen.unmount();
    await rejection;
  });

  it('renders the active sheet only in the latest registered Host', async () => {
    const screen = render(
      <>
        <ShareSheetHost />
        <ShareSheetHost />
      </>
    );
    const { pending: promise } = await show();

    expect(
      screen.UNSAFE_getAllByType(Modal).filter((modal) => modal.props.visible)
    ).toHaveLength(1);
    expect(
      screen.getAllByTestId('umeng-share-cell-wechat_session')
    ).toHaveLength(1);

    const rejection = expectRejectsWith(promise, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('umeng-share-cancel'));
      await rejection;
    });
  });

  it('keeps a visible uninstalled platform clickable and rejects without a native call', async () => {
    (Share.listPlatforms as jest.Mock).mockResolvedValue([
      {
        platform: Platform.WECHAT_SESSION,
        installed: false,
        displayName: '微信',
      },
      INSTALLED_PLATFORMS[1],
    ]);
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show(TEXT_PAYLOAD, {
      hideUninstalled: false,
    });
    const cell = screen.getByTestId('umeng-share-cell-wechat_session');

    expect(cell.props.disabled).toBeUndefined();
    expect(cell.props.accessibilityState?.disabled).toBeUndefined();

    const rejection = expectRejectsWith(promise, {
      code: 'E_PLATFORM_NOT_INSTALLED',
      message: '微信 未安装',
    });
    await act(async () => {
      fireEvent.press(cell);
      await rejection;
    });
    expect(Share.shareText).not.toHaveBeenCalled();
  });

  it('does not render an uninstalled platform when hideUninstalled is true', async () => {
    (Share.listPlatforms as jest.Mock).mockResolvedValue([
      {
        platform: Platform.WECHAT_SESSION,
        installed: false,
        displayName: '微信',
      },
      INSTALLED_PLATFORMS[1],
    ]);
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show(TEXT_PAYLOAD, {
      hideUninstalled: true,
    });

    expect(screen.queryByTestId('umeng-share-cell-wechat_session')).toBeNull();
    expect(screen.queryByTestId('umeng-share-cell-dingtalk')).not.toBeNull();

    const rejection = expectRejectsWith(promise, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('umeng-share-cancel'));
      await rejection;
    });
  });

  it('mounts GestureHandlerRootView inside the Modal content', async () => {
    const screen = render(<ShareSheetHost />);
    const { pending: promise } = await show();
    const modal = screen.UNSAFE_getByType(Modal);

    expect(modal.findByType(GestureHandlerRootView)).toBeTruthy();

    const rejection = expectRejectsWith(promise, {
      code: 'E_USER_CANCEL',
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('umeng-share-cancel'));
      await rejection;
    });
  });
});
