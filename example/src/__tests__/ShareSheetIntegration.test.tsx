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

import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Modal } from 'react-native';
import { ThemeProvider, useTheme } from '@unif/react-native-design';
import {
  useShareSheet,
  type ShareSheetController,
  type ShareResult,
} from '@unif/react-native-umeng';

let controller: ShareSheetController;
let surface: string;
function Panel() {
  const [sheet, host] = useShareSheet();
  controller = sheet;
  surface = useTheme().colors.surface;
  return host;
}
it.each(['light', 'dark'] as const)(
  'uses the actual local Design %s theme and actual sheet with large text',
  async (scheme) => {
    const screen = render(
      <ThemeProvider forceScheme={scheme} fontScale={1.5}>
        <Panel />
      </ThemeProvider>
    );
    let result!: Promise<ShareResult>;
    await act(async () => {
      result = controller.open(
        { type: 'text', text: 'hello' },
        { presentation: 'floating' }
      );
    });
    expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
    expect(
      StyleSheet.flatten(screen.getByTestId('umeng-share-sheet').props.style)
        .backgroundColor
    ).toBe(surface);
    expect(
      StyleSheet.flatten(screen.getByText('分享至').props.style).fontSize
    ).toBe(22.5);
    await act(async () =>
      fireEvent.press(screen.getByTestId('umeng-share-cell-wechat_session'))
    );
    await expect(result).resolves.toEqual({
      status: 'success',
      target: 'wechat_session',
    });
  }
);
