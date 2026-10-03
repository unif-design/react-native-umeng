import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as api from '@unif/react-native-umeng';
import { shareSuccess } from '@unif/react-native-umeng/mock';
import App from '../App';

const sheetOpen = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.initializeUmeng).mockResolvedValue(undefined);
  jest.mocked(api.isUmengInitialized).mockResolvedValue(true);
  jest
    .mocked(api.getShareTargets)
    .mockResolvedValue([
      { target: 'wechat_session', label: '微信', installed: true },
    ]);
  jest
    .mocked(api.share)
    .mockImplementation(async (input) => shareSuccess(input.target));
  jest.mocked(api.useShareSheet).mockReturnValue([{ open: sheetOpen }, <></>]);
  sheetOpen.mockResolvedValue({ status: 'cancelled' });
});
async function initialize() {
  render(<App />);
  fireEvent.changeText(screen.getByLabelText('Umeng AppKey'), 'app-key');
  fireEvent.press(screen.getByRole('button', { name: '确认配置' }));
  await screen.findByText('请阅读并明确同意隐私政策');
  expect(api.initializeUmeng).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('switch', { name: '同意隐私政策' }));
  fireEvent.press(screen.getByRole('button', { name: '同意并初始化' }));
  await screen.findByText('分享展厅');
}
it('only initializes with the reviewed configuration after explicit consent', async () => {
  await initialize();
  expect(api.initializeUmeng).toHaveBeenCalledTimes(1);
  expect(api.initializeUmeng).toHaveBeenCalledWith({ appKey: 'app-key' });
  for (const title of [
    '平台状态',
    '分享面板',
    '直接分享',
    'Analytics',
    '运行日志',
  ]) {
    fireEvent.press(screen.getByRole('button', { name: title }));
    expect(await screen.findByText(title)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: '返回' }));
  }
});
it('submits the public sheet content and options and displays cancellation', async () => {
  await initialize();
  fireEvent.press(screen.getByRole('button', { name: '分享面板' }));
  fireEvent.changeText(screen.getByLabelText('分享文本'), 'hello sheet');
  fireEvent.press(screen.getByRole('button', { name: '打开分享面板' }));
  await waitFor(() =>
    expect(sheetOpen).toHaveBeenCalledWith(
      { type: 'text', text: 'hello sheet' },
      expect.objectContaining({ presentation: 'modal' })
    )
  );
  expect(await screen.findByText('已取消分享')).toBeOnTheScreen();
});
it('records a synchronous analytics handoff without claiming upload completion', async () => {
  await initialize();
  fireEvent.press(screen.getByRole('button', { name: 'Analytics' }));
  fireEvent.press(screen.getByRole('button', { name: '记录事件' }));
  await waitFor(() => expect(api.trackEvent).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('JS 已调用 trackEvent')).toBeOnTheScreen();
});
