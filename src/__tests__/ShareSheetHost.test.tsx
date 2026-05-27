jest.mock('@unif/react-native-design', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    ThemeProvider: ({ children }: any) => children,
    useTheme: () => ({
      c: { surfaceContainer: '#f0f0f0', foreground: '#111' },
    }),
    BottomSheet: ({ children }: any) =>
      React.createElement(View, { testID: 'bottom-sheet' }, children),
    Cell: ({ title, desc, onPress, disabled, testID }: any) =>
      React.createElement(
        TouchableOpacity,
        { testID, onPress, disabled, accessibilityState: { disabled } },
        React.createElement(Text, null, title),
        desc && React.createElement(Text, null, desc)
      ),
    Button: ({ label, onPress, testID }: any) =>
      React.createElement(
        TouchableOpacity,
        { testID, onPress },
        React.createElement(Text, null, label)
      ),
  };
});
jest.mock('../share', () => ({
  shareText: jest.fn(),
  shareImage: jest.fn(),
  shareLink: jest.fn(),
  isInstalled: jest.fn(),
  listPlatforms: jest.fn(),
}));

import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { ShareSheetHost } from '../ShareSheet/ShareSheetHost';
import { shareSheetController } from '../ShareSheet/ShareSheetController';
import { Platform } from '../types';
import * as Share from '../share';

describe('ShareSheetHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 清理 module-level controller singleton 上一轮残留的 pending
    try {
      shareSheetController.dismiss('cancel');
    } catch {
      // dismiss 不抛错；只是 .show 的 Promise 被 rejected
    }
    (Share.listPlatforms as jest.Mock).mockResolvedValue([
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
      },
      { platform: Platform.DINGTALK, installed: true, displayName: '钉钉' },
    ]);
  });

  it('renders a Cell for each supported platform when shown', async () => {
    const { queryByTestId } = render(<ShareSheetHost />);
    const p = shareSheetController.show({ type: 'text', text: 'hi' });
    p.catch(() => {});
    await act(async () => {});
    expect(queryByTestId('umeng-share-cell-wechat_session')).not.toBeNull();
    expect(queryByTestId('umeng-share-cell-dingtalk')).not.toBeNull();
  });

  it('dismisses on cancel button press', async () => {
    const { getByTestId } = render(<ShareSheetHost />);
    const p = shareSheetController.show({ type: 'text', text: 'hi' });
    await act(async () => {});
    fireEvent.press(getByTestId('umeng-share-cancel'));
    await expect(p).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
  });

  it('calls Share.shareText when wechat platform is tapped with text payload', async () => {
    (Share.shareText as jest.Mock).mockResolvedValue({
      code: 'success',
      platform: Platform.WECHAT_SESSION,
    });
    const { getByTestId } = render(<ShareSheetHost />);
    const p = shareSheetController.show({ type: 'text', text: 'hello' });
    await act(async () => {});
    fireEvent.press(getByTestId('umeng-share-cell-wechat_session'));
    await expect(p).resolves.toMatchObject({
      code: 'success',
      platform: Platform.WECHAT_SESSION,
    });
    expect(Share.shareText).toHaveBeenCalledWith({
      platform: Platform.WECHAT_SESSION,
      text: 'hello',
    });
  });

  it('marks uninstalled platform cell as disabled (and hides it under hideUninstalled)', async () => {
    (Share.listPlatforms as jest.Mock).mockResolvedValue([
      {
        platform: Platform.WECHAT_SESSION,
        installed: false,
        displayName: '微信',
      },
      { platform: Platform.DINGTALK, installed: true, displayName: '钉钉' },
    ]);
    const { getByTestId, queryByTestId, unmount } = render(<ShareSheetHost />);
    const p = shareSheetController.show({ type: 'text', text: 'hi' });
    p.catch(() => {});
    await act(async () => {});
    expect(
      getByTestId('umeng-share-cell-wechat_session').props.accessibilityState
        .disabled
    ).toBe(true);
    expect(
      getByTestId('umeng-share-cell-dingtalk').props.accessibilityState.disabled
    ).toBe(false);
    unmount();
    shareSheetController.dismiss('cancel');

    // hideUninstalled=true 时未安装平台不渲染
    const { queryByTestId: queryByTestId2 } = render(<ShareSheetHost />);
    const p2 = shareSheetController.show(
      { type: 'text', text: 'hi' },
      { hideUninstalled: true }
    );
    p2.catch(() => {});
    await act(async () => {});
    expect(queryByTestId2('umeng-share-cell-wechat_session')).toBeNull();
    expect(queryByTestId2('umeng-share-cell-dingtalk')).not.toBeNull();
    expect(queryByTestId).toBeDefined();
  });
});
