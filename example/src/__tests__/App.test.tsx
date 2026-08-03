import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Analytics, Common, Platform, Share } from '@unif/react-native-umeng';
import { shareSuccess } from '@unif/react-native-umeng/mock';

import App from '../App';

const mockedCommon = Common as jest.Mocked<typeof Common>;
const mockedShare = Share as jest.Mocked<typeof Share>;
const mockedAnalytics = Analytics as jest.Mocked<typeof Analytics>;

function restoreOfficialMockDefaults(): void {
  mockedCommon.preInit.mockResolvedValue(undefined);
  mockedCommon.init.mockResolvedValue(undefined);
  mockedCommon.isInited.mockResolvedValue(true);
  mockedShare.listPlatforms.mockResolvedValue([
    {
      platform: Platform.WECHAT_SESSION,
      displayName: '微信会话',
      installed: true,
    },
    {
      platform: Platform.DINGTALK,
      displayName: '钉钉',
      installed: true,
    },
  ]);
  mockedShare.isInstalled.mockResolvedValue(true);
  mockedShare.shareText.mockImplementation((options) =>
    Promise.resolve(shareSuccess(options.platform))
  );
  mockedShare.shareImage.mockImplementation((options) =>
    Promise.resolve(shareSuccess(options.platform))
  );
  mockedShare.shareLink.mockImplementation((options) =>
    Promise.resolve(shareSuccess(options.platform))
  );
  mockedShare.openSheet.mockResolvedValue(
    shareSuccess(Platform.WECHAT_SESSION)
  );
  mockedAnalytics.onEvent.mockImplementation(() => undefined);
  mockedAnalytics.signIn.mockImplementation(() => undefined);
  mockedAnalytics.signOut.mockImplementation(() => undefined);
}

beforeEach(() => {
  restoreOfficialMockDefaults();
});

afterEach(() => {
  jest.resetAllMocks();
});

async function renderInitializedApp(): Promise<void> {
  render(<App />);
  fireEvent.changeText(screen.getByLabelText('Umeng AppKey'), 'app-key');
  fireEvent.press(screen.getByRole('button', { name: '预初始化' }));
  await screen.findByText('请阅读并明确同意隐私政策');
  fireEvent.press(screen.getByRole('switch', { name: '同意隐私政策' }));
  fireEvent.press(screen.getByRole('button', { name: '同意并初始化' }));
  await screen.findByText('分享展厅');
}

it('启动时只显示空白合规表单，不自动预初始化或展示业务页', async () => {
  render(<App />);

  expect(screen.getByText('合规初始化')).toBeOnTheScreen();
  expect(screen.getByLabelText('Umeng AppKey')).toHaveProp('value', '');
  expect(screen.queryByText('分享展厅')).not.toBeOnTheScreen();

  await act(async () => {
    await Promise.resolve();
  });
  expect(mockedCommon.preInit).not.toHaveBeenCalled();
  expect(mockedCommon.init).not.toHaveBeenCalled();
});

it('只在用户提交运行时凭据后 preInit，且等待明示同意', async () => {
  render(<App />);

  fireEvent.changeText(screen.getByLabelText('Umeng AppKey'), 'app-key');
  fireEvent.press(screen.getByRole('button', { name: '预初始化' }));

  await screen.findByText('请阅读并明确同意隐私政策');
  expect(mockedCommon.preInit).toHaveBeenCalledTimes(1);
  expect(mockedCommon.preInit).toHaveBeenCalledWith({ appkey: 'app-key' });
  expect(mockedCommon.init).not.toHaveBeenCalled();
  expect(
    screen.getByRole('switch', { name: '同意隐私政策' })
  ).not.toBeChecked();
});

it('明示同意后无参 init，并从首页进入五个业务页后返回', async () => {
  await renderInitializedApp();

  expect(mockedCommon.init).toHaveBeenCalledTimes(1);
  expect(mockedCommon.init).toHaveBeenCalledWith();

  const destinations = [
    '平台状态',
    '分享面板',
    '直接分享',
    'Analytics',
    '运行日志',
  ] as const;
  for (const title of destinations) {
    fireEvent.press(screen.getByRole('button', { name: title }));
    expect(await screen.findByText(title)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: '返回' }));
    expect(await screen.findByText('分享展厅')).toBeOnTheScreen();
  }
});

it('平台查询失败保留上一次可信安装状态并展示错误', async () => {
  await renderInitializedApp();
  fireEvent.press(screen.getByRole('button', { name: '平台状态' }));
  await screen.findByText('微信会话');

  mockedShare.isInstalled.mockRejectedValueOnce(new Error('network detail'));
  fireEvent.press(screen.getByRole('button', { name: '重新检测微信会话' }));

  expect(
    await screen.findByText('发生未识别错误，请稍后重试')
  ).toBeOnTheScreen();
  expect(screen.getAllByText('已安装')).toHaveLength(2);
  expect(screen.queryByText('未安装')).not.toBeOnTheScreen();
});

it('分享面板切换三种 payload，并提交全部公开 options', async () => {
  await renderInitializedApp();
  fireEvent.press(screen.getByRole('button', { name: '分享面板' }));

  fireEvent.changeText(screen.getByLabelText('分享文本'), 'hello sheet');
  fireEvent.changeText(screen.getByLabelText('面板标题'), '选择渠道');
  fireEvent.changeText(screen.getByLabelText('取消按钮文案'), '稍后');
  fireEvent.changeText(screen.getByLabelText('微信副标题'), '发给微信好友');
  fireEvent.changeText(screen.getByLabelText('钉钉副标题'), '发给钉钉联系人');
  fireEvent.press(screen.getByRole('switch', { name: '隐藏未安装平台' }));
  fireEvent.press(screen.getByRole('button', { name: '打开分享面板' }));

  await waitFor(() =>
    expect(mockedShare.openSheet).toHaveBeenLastCalledWith(
      { type: 'text', text: 'hello sheet' },
      {
        title: '选择渠道',
        cancelText: '稍后',
        subtitles: {
          [Platform.WECHAT_SESSION]: '发给微信好友',
          [Platform.DINGTALK]: '发给钉钉联系人',
        },
        hideUninstalled: true,
      }
    )
  );

  fireEvent.press(screen.getByRole('tab', { name: '图片' }));
  const imagePreview = screen.getByLabelText('分享图片预览');
  fireEvent(imagePreview, 'load');
  fireEvent.press(screen.getByRole('button', { name: '打开分享面板' }));
  await waitFor(() =>
    expect(mockedShare.openSheet).toHaveBeenLastCalledWith(
      {
        type: 'image',
        image: 'https://unif-design.github.io/react-native-umeng/img/logo.png',
        thumb: 'https://unif-design.github.io/react-native-umeng/img/logo.png',
      },
      expect.objectContaining({ hideUninstalled: true })
    )
  );

  fireEvent.press(screen.getByRole('tab', { name: '链接' }));
  fireEvent(screen.getByLabelText('分享缩略图预览'), 'load');
  fireEvent.press(screen.getByRole('button', { name: '打开分享面板' }));
  await waitFor(() =>
    expect(mockedShare.openSheet).toHaveBeenLastCalledWith(
      {
        type: 'link',
        title: '@unif/react-native-umeng',
        url: 'https://unif-design.github.io/react-native-umeng/',
        description: '合规初始化、微信会话与钉钉分享示例',
        thumb: 'https://unif-design.github.io/react-native-umeng/img/logo.png',
      },
      expect.objectContaining({ hideUninstalled: true })
    )
  );
});

it('图片预览失败时禁用本次分享，修改 URL 并加载后可恢复', async () => {
  await renderInitializedApp();
  fireEvent.press(screen.getByRole('button', { name: '分享面板' }));
  fireEvent.press(screen.getByRole('tab', { name: '图片' }));

  fireEvent(screen.getByLabelText('分享图片预览'), 'error');
  expect(
    await screen.findByText('图片预览失败，请修改 URL 后重试')
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '打开分享面板' })).toBeDisabled();

  fireEvent.changeText(
    screen.getByLabelText('图片 URL'),
    'https://example.com/recovered.png'
  );
  fireEvent(screen.getByLabelText('分享图片预览'), 'load');
  const openButton = screen.getByRole('button', { name: '打开分享面板' });
  expect(openButton).toBeEnabled();
  fireEvent.press(openButton);

  await waitFor(() =>
    expect(mockedShare.openSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image',
        image: 'https://example.com/recovered.png',
      }),
      expect.any(Object)
    )
  );
});

it('直接分享暴露两平台乘三类型六个公开动作', async () => {
  await renderInitializedApp();
  fireEvent.press(screen.getByRole('button', { name: '直接分享' }));
  fireEvent(screen.getByLabelText('分享图片预览'), 'load');

  const cases = [
    ['微信会话 · 文本', mockedShare.shareText],
    ['微信会话 · 图片', mockedShare.shareImage],
    ['微信会话 · 链接', mockedShare.shareLink],
    ['钉钉 · 文本', mockedShare.shareText],
    ['钉钉 · 图片', mockedShare.shareImage],
    ['钉钉 · 链接', mockedShare.shareLink],
  ] as const;
  for (const [name, method] of cases) {
    const callsBefore = method.mock.calls.length;
    fireEvent.press(screen.getByRole('button', { name }));
    await waitFor(() => expect(method).toHaveBeenCalledTimes(callsBefore + 1));
  }

  expect(mockedShare.shareText).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ platform: Platform.WECHAT_SESSION })
  );
  expect(mockedShare.shareText).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ platform: Platform.DINGTALK })
  );
  expect(await screen.findByText('success@dingtalk')).toBeOnTheScreen();
});

it('Analytics 同步调用后日志最新在前、可清空且不展示敏感入参', async () => {
  await renderInitializedApp();
  fireEvent.press(screen.getByRole('button', { name: 'Analytics' }));

  fireEvent.changeText(screen.getByLabelText('事件 ID'), 'sensitive-event-id');
  fireEvent.changeText(screen.getByLabelText('用户 ID'), 'sensitive-user-id');
  fireEvent.changeText(screen.getByLabelText('Provider'), 'sensitive-provider');
  fireEvent.press(screen.getByRole('button', { name: '记录事件' }));
  expect(mockedAnalytics.onEvent).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: '登录用户' }));
  expect(mockedAnalytics.signIn).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: '退出登录' }));
  expect(mockedAnalytics.signOut).toHaveBeenCalledTimes(1);

  fireEvent.press(screen.getByRole('button', { name: '返回' }));
  fireEvent.press(screen.getByRole('button', { name: '运行日志' }));
  const analyticsLogs = screen.getAllByText(/JS 已调用 Analytics\./);
  expect(analyticsLogs[0]).toHaveTextContent(/Analytics\.signOut/);
  expect(analyticsLogs[1]).toHaveTextContent(/Analytics\.signIn/);
  expect(analyticsLogs[2]).toHaveTextContent(/Analytics\.onEvent/);
  expect(screen.queryByText(/sensitive-/)).not.toBeOnTheScreen();

  fireEvent.press(screen.getByRole('button', { name: '清空日志' }));
  expect(await screen.findByText('暂无运行日志')).toBeOnTheScreen();
});
