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

it('updates all sheet options and waits for actual image preview callbacks', async () => {
  await initialize();
  fireEvent.press(screen.getByRole('button', { name: '分享面板' }));
  for (const [label, value] of [
    ['面板标题', '同事'],
    ['取消按钮文案', '关闭'],
    ['微信副标题', '朋友'],
    ['钉钉副标题', '团队'],
  ]) {
    fireEvent.changeText(screen.getByLabelText(label!), value!);
  }
  fireEvent.press(screen.getByRole('switch', { name: '隐藏未安装平台' }));
  fireEvent.press(screen.getByText('浮动'));
  fireEvent.press(screen.getByText('图片'));
  expect(screen.getByRole('button', { name: '打开分享面板' })).toBeDisabled();
  for (const image of screen.UNSAFE_getAllByType(
    require('react-native').Image
  )) {
    fireEvent(image, 'load');
    fireEvent(image, 'load');
  }
  sheetOpen.mockResolvedValueOnce({
    status: 'success',
    target: 'wechat_session',
  });
  fireEvent.press(screen.getByRole('button', { name: '打开分享面板' }));
  await waitFor(() =>
    expect(sheetOpen).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'image' }),
      expect.objectContaining({
        title: '同事',
        cancelText: '关闭',
        subtitles: { wechat_session: '朋友', dingtalk: '团队' },
        hideUninstalled: true,
        presentation: 'floating',
      })
    )
  );
  expect(await screen.findByText('success@wechat_session')).toBeOnTheScreen();
  fireEvent.press(screen.getByText('链接'));
  fireEvent.changeText(screen.getByLabelText('链接标题'), 'edited');
});

it('submits edited direct shares and shows cancellation and SDK errors in logs', async () => {
  await initialize();
  fireEvent.press(screen.getByRole('button', { name: '直接分享' }));
  fireEvent.changeText(
    screen.getByLabelText('图片 URL'),
    'https://example.com/edited.png'
  );
  for (const image of screen.UNSAFE_getAllByType(
    require('react-native').Image
  )) {
    fireEvent(image, 'load');
    fireEvent(image, 'load');
  }
  fireEvent.press(screen.getByLabelText('微信会话 · 图片'));
  expect(await screen.findByText('success@wechat_session')).toBeOnTheScreen();
  fireEvent.press(screen.getByText('编辑文本'));
  fireEvent.changeText(screen.getByLabelText('分享文本'), 'edited text');
  jest
    .mocked(api.share)
    .mockResolvedValueOnce({ status: 'cancelled', target: 'wechat_session' });
  fireEvent.press(screen.getByLabelText('微信会话 · 文本'));
  expect(await screen.findByText('已取消分享')).toBeOnTheScreen();
  jest.mocked(api.share).mockResolvedValueOnce({
    status: 'failed',
    error: { reason: 'not_installed', message: 'unavailable' },
  });
  fireEvent.press(screen.getByLabelText('微信会话 · 文本'));
  expect(await screen.findByText('请注意')).toBeOnTheScreen();
  jest.mocked(api.share).mockRejectedValueOnce(new Error('SDK failure'));
  fireEvent.press(screen.getByLabelText('微信会话 · 文本'));
  expect(await screen.findByText('操作失败')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: '运行日志' }));
  expect(screen.getByText(/cancelled/)).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('清空日志'));
  expect(screen.getByText('暂无运行日志')).toBeOnTheScreen();
});

it('refreshes stale platform state and rechecks a missing target', async () => {
  await initialize();
  fireEvent.press(screen.getByRole('button', { name: '平台状态' }));
  jest
    .mocked(api.getShareTargets)
    .mockRejectedValueOnce(new Error('query failed'));
  fireEvent.press(screen.getByRole('button', { name: '刷新平台列表' }));
  expect(await screen.findByText('需复查')).toBeOnTheScreen();
  jest
    .mocked(api.getShareTargets)
    .mockResolvedValueOnce([
      { target: 'wechat_session', label: '微信', installed: false },
    ]);
  fireEvent.press(screen.getByRole('button', { name: '重新检测微信' }));
  expect(await screen.findByText('未安装')).toBeOnTheScreen();
});

it('binds analytics with optional provider and displays failures', async () => {
  await initialize();
  fireEvent.press(screen.getByRole('button', { name: 'Analytics' }));
  fireEvent.changeText(screen.getByLabelText('用户 ID'), 'user');
  fireEvent.changeText(screen.getByLabelText('Provider'), 'team');
  fireEvent.press(screen.getByRole('button', { name: '登录用户' }));
  expect(api.bindAnalyticsUser).toHaveBeenLastCalledWith({
    userId: 'user',
    provider: 'team',
  });
  fireEvent.changeText(screen.getByLabelText('Provider'), ' ');
  fireEvent.press(screen.getByRole('button', { name: '登录用户' }));
  expect(api.bindAnalyticsUser).toHaveBeenLastCalledWith({
    userId: 'user',
    provider: undefined,
  });
  jest.mocked(api.clearAnalyticsUser).mockImplementationOnce(() => {
    throw new Error('SDK failure');
  });
  fireEvent.press(screen.getByRole('button', { name: '退出登录' }));
  expect(await screen.findByText('操作失败')).toBeOnTheScreen();
});

it('retries a failed initialization through its visible control', async () => {
  jest
    .mocked(api.initializeUmeng)
    .mockRejectedValueOnce(new Error('init failed'));
  render(<App />);
  fireEvent.changeText(screen.getByLabelText('Umeng AppKey'), 'app-key');
  fireEvent.press(screen.getByRole('button', { name: '确认配置' }));
  await screen.findByText('请阅读并明确同意隐私政策');
  fireEvent.press(screen.getByRole('switch', { name: '同意隐私政策' }));
  fireEvent.press(screen.getByRole('button', { name: '同意并初始化' }));
  expect(
    await screen.findByRole('button', { name: '重试初始化' })
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: '重试初始化' }));
  expect(await screen.findByText('分享展厅')).toBeOnTheScreen();
  expect(api.initializeUmeng).toHaveBeenCalledTimes(2);
});
