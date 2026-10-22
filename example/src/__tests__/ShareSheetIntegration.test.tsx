jest.unmock('@unif/react-native-umeng');
jest.mock('../../../src/NativeUmengCommon', () => ({
  __esModule: true,
  default: {
    getConfiguredShareTargets: jest.fn().mockResolvedValue(['wechat_session']),
  },
}));
jest.mock('../../../src/NativeUmengShare', () => ({
  __esModule: true,
  default: {
    isInstalled: jest.fn().mockResolvedValue(true),
    shareText: jest
      .fn()
      .mockResolvedValue({ code: 'success', platform: 'wechat_session' }),
  },
}));

import { act, fireEvent, render, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Modal, View } from 'react-native';
import {
  GlassLayer,
  ThemeProvider,
  type as typography,
  useTheme,
} from '@unif/react-native-design';
import {
  useShareSheet,
  type ShareSheetController,
  type ShareResult,
} from '@unif/react-native-umeng';
import NativeCommon from '../../../src/NativeUmengCommon';
import NativeShare from '../../../src/NativeUmengShare';

let controller: ShareSheetController;
let surface: string;
function Panel() {
  const [sheet, host] = useShareSheet();
  controller = sheet;
  surface = useTheme().colors.surface;
  return host;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

it.each([
  { scheme: 'light', presentation: 'floating' },
  { scheme: 'dark', presentation: 'floating' },
  { scheme: 'light', presentation: 'modal' },
  { scheme: 'dark', presentation: 'modal' },
] as const)(
  '$presentation material follows the local $scheme theme without reopening the share session',
  async ({ scheme, presentation }) => {
    const screen = render(
      <ThemeProvider forceScheme={scheme} fontScale={1.5}>
        <Panel />
      </ThemeProvider>
    );
    const originalController = controller;
    const onDismiss = jest.fn();
    let result!: Promise<ShareResult>;
    await act(async () => {
      result = controller.open(
        { type: 'text', text: 'hello' },
        { presentation, onDismiss }
      );
    });
    if (presentation === 'modal') {
      await act(async () => screen.UNSAFE_getByType(Modal).props.onShow());
    } else {
      expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
      expect(
        screen.getByTestId('umeng-share-floating-root').props.pointerEvents
      ).toBe('box-none');
    }
    expect(
      screen.getByTestId('umeng-share-glass', { includeHiddenElements: true })
    ).toHaveStyle({
      backgroundColor: surface,
    });
    expect(
      screen.getByTestId('umeng-share-glass', { includeHiddenElements: true })
        .props.pointerEvents
    ).toBe('none');
    expect(
      screen.getByTestId('umeng-share-cancel').findAllByType(GlassLayer)
    ).toHaveLength(1);
    const cellSurface = screen
      .getByTestId('umeng-share-cell-wechat_session')
      .findAllByType(View)
      .find(
        (view) => StyleSheet.flatten(view.props.style)?.backgroundColor != null
      );
    expect(StyleSheet.flatten(cellSurface?.props.style)).toMatchObject({
      backgroundColor: 'transparent',
    });
    const target = within(screen.getByTestId('umeng-share-sheet')).getByRole(
      'button',
      { name: '微信，发送给好友或群 · 已安装' }
    );
    expect(within(target).getByText('发送给好友或群 · 已安装')).toBeTruthy();
    expect(
      StyleSheet.flatten(screen.getByText('分享至').props.style).fontSize
    ).toBe(typography.body * 1.5);
    screen.rerender(
      <ThemeProvider
        forceScheme={scheme === 'light' ? 'dark' : 'light'}
        fontScale={1.25}
      >
        <Panel />
      </ThemeProvider>
    );
    expect(controller).toBe(originalController);
    expect(
      screen.getByTestId('umeng-share-glass', { includeHiddenElements: true })
    ).toHaveStyle({
      backgroundColor: surface,
    });
    expect(
      StyleSheet.flatten(screen.getByText('分享至').props.style).fontSize
    ).toBe(typography.body * 1.25);
    expect(NativeCommon!.getConfiguredShareTargets).toHaveBeenCalledTimes(1);
    expect(NativeShare!.isInstalled).toHaveBeenCalledTimes(1);
    await act(async () =>
      fireEvent.press(screen.getByTestId('umeng-share-cell-wechat_session'))
    );
    await expect(result).resolves.toEqual({
      status: 'success',
      target: 'wechat_session',
    });
    if (presentation === 'modal') {
      await act(async () => screen.UNSAFE_getByType(Modal).props.onDismiss());
    }
    expect(onDismiss).toHaveBeenCalledTimes(1);
  }
);

it.each(['modal', 'floating'] as const)(
  '%s secondary cancel keeps the original cancellation result without sharing',
  async (presentation) => {
    const screen = render(
      <ThemeProvider forceScheme="dark">
        <Panel />
      </ThemeProvider>
    );
    const onDismiss = jest.fn();
    let result!: Promise<ShareResult>;
    await act(async () => {
      result = controller.open(
        { type: 'text', text: 'cancel this share' },
        { presentation, onDismiss }
      );
    });
    if (presentation === 'modal') {
      await act(async () => screen.UNSAFE_getByType(Modal).props.onShow());
    }
    const cancel = screen.getByTestId('umeng-share-cancel');
    expect(cancel.findAllByType(GlassLayer)).toHaveLength(1);
    await act(async () => fireEvent.press(cancel));
    if (presentation === 'modal') {
      await act(async () => screen.UNSAFE_getByType(Modal).props.onDismiss());
    }
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(NativeShare!.shareText).not.toHaveBeenCalled();
    expect(NativeCommon!.getConfiguredShareTargets).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  }
);
