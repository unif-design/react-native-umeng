import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { CredentialForm } from '../components/CredentialForm';
import { SharePayloadEditor } from '../components/SharePayloadEditor';
import { OperationFeedback } from '../components/OperationFeedback';
import { EMPTY_CREDENTIAL_DRAFT } from '../state/setupState';
import { DEFAULT_SHARE_CONTENT } from '../content/shareContent';
import { requiredPreviews, isPreviewReady } from '../state/previewState';
import { useShowcase } from '../state/useShowcase';

it('delivers every credential edit and exposes enabled vendor fields', () => {
  const change = jest.fn();
  const screen = render(
    <ThemeProvider>
      <CredentialForm
        draft={{
          ...EMPTY_CREDENTIAL_DRAFT,
          wechatEnabled: true,
          dingtalkEnabled: true,
        }}
        errors={{ appkey: 'required' }}
        disabled={false}
        onChange={change}
      />
    </ThemeProvider>
  );
  for (const [label, field] of [
    ['Umeng AppKey', 'appkey'],
    ['Channel', 'channel'],
    ['微信 App ID', 'wechatAppId'],
    ['微信 App Secret', 'wechatAppSecret'],
    ['微信 Universal Link', 'wechatUniversalLink'],
    ['钉钉 App ID', 'dingtalkAppId'],
  ]) {
    fireEvent.changeText(screen.getByLabelText(label!), 'edited');
    expect(change).toHaveBeenLastCalledWith(field, 'edited');
  }
  for (const [label, field] of [
    ['启用微信', 'wechatEnabled'],
    ['启用钉钉', 'dingtalkEnabled'],
  ]) {
    fireEvent.press(screen.getByRole('switch', { name: label }));
    expect(change).toHaveBeenLastCalledWith(field, false);
  }
  screen.rerender(
    <ThemeProvider>
      <CredentialForm
        draft={EMPTY_CREDENTIAL_DRAFT}
        errors={{}}
        disabled
        onChange={change}
      />
    </ThemeProvider>
  );
  expect(screen.queryByLabelText('微信 App ID')).toBeNull();
  expect(screen.queryByLabelText('钉钉 App ID')).toBeNull();
});

it('forwards payload edits and reports real image loading and failure callbacks', () => {
  const change = jest.fn();
  const resolution = jest.fn();
  const draft = { ...DEFAULT_SHARE_CONTENT };
  const element = (
    type: 'text' | 'image' | 'link',
    resolutions: Record<string, 'ready' | 'error'> = {}
  ) => (
    <ThemeProvider>
      <SharePayloadEditor
        type={type}
        draft={draft}
        onChange={change}
        previewResolutions={resolutions}
        onPreviewResolutionChange={resolution}
      />
    </ThemeProvider>
  );
  const screen = render(element('text'));
  fireEvent.changeText(screen.getByLabelText('分享文本'), 'hello');
  expect(change).toHaveBeenLastCalledWith('text', 'hello');
  screen.rerender(element('image'));
  for (const [label, field] of [
    ['图片 URL', 'image'],
    ['图片缩略图 URL', 'thumb'],
  ]) {
    fireEvent.changeText(
      screen.getByLabelText(label!),
      'https://example.com/new.png'
    );
    expect(change).toHaveBeenLastCalledWith(
      field,
      'https://example.com/new.png'
    );
  }
  const previews = requiredPreviews('image', draft);
  expect(screen.getAllByText('正在检查远程素材')).toHaveLength(2);
  for (const preview of previews) {
    fireEvent(screen.getByLabelText(preview.accessibilityLabel), 'load');
    expect(resolution).toHaveBeenLastCalledWith(preview.key, 'ready');
    fireEvent(screen.getByLabelText(preview.accessibilityLabel), 'error', {
      nativeEvent: { error: 'network' },
    });
    expect(resolution).toHaveBeenLastCalledWith(preview.key, 'error');
  }
  screen.rerender(
    element('image', {
      [previews[0]!.key]: 'ready',
      [previews[1]!.key]: 'error',
    })
  );
  expect(screen.getByText('素材预览可用')).toBeTruthy();
  expect(screen.getByText('图片预览失败，请修改 URL 后重试')).toBeTruthy();
  screen.rerender(element('link'));
  for (const [label, field] of [
    ['链接标题', 'title'],
    ['链接 URL', 'url'],
    ['链接描述', 'description'],
    ['链接缩略图 URL', 'thumb'],
  ]) {
    fireEvent.changeText(screen.getByLabelText(label!), 'changed');
    expect(change).toHaveBeenLastCalledWith(field, 'changed');
  }
});

it('requires only nonblank preview assets and reports readiness for each URL', () => {
  const draft = { ...DEFAULT_SHARE_CONTENT, thumb: '   ' };
  expect(requiredPreviews('text', draft)).toEqual([]);
  expect(requiredPreviews('link', draft)).toEqual([]);
  const image = requiredPreviews('image', draft);
  expect(image).toHaveLength(1);
  expect(isPreviewReady('image', draft, {})).toBe(false);
  expect(isPreviewReady('image', draft, { [image[0]!.key]: 'ready' })).toBe(
    true
  );
});

it.each([
  ['neutral', '已结束'],
  ['warning', '请注意'],
  ['error', '操作失败'],
] as const)('shows %s feedback without displaying success', (tone, label) => {
  const screen = render(
    <ThemeProvider>
      <OperationFeedback
        feedback={{
          tone,
          code: 'sdk_failed',
          message: 'safe message',
          restartRequired: false,
        }}
      />
    </ThemeProvider>
  );
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText('safe message')).toBeTruthy();
  expect(screen.queryByText('操作成功')).toBeNull();
});

it('requires the actual showcase provider', () => {
  function MissingProvider() {
    useShowcase();
    return null;
  }
  expect(() => render(<MissingProvider />)).toThrow('ShowcaseProvider');
});

it('renders all setup status inputs through the real Context boundary', () => {
  // The view consumes context as input. Keep its hook and implementation real;
  // the provider/reducer transitions and action behavior have separate tests.
  const { ShowcaseContext } = require('../state/useShowcase');
  const { SetupScreen } = require('../screens/SetupScreen');
  const { createInitialSetupState } = require('../state/setupState');
  const { createInitialPlatformState } = require('../state/operations');
  const element = (phase: string) => (
    <ThemeProvider>
      <ShowcaseContext.Provider
        value={{
          state: {
            setup: { ...createInitialSetupState(), phase },
            navigation: { stack: ['setup'] },
            platforms: createInitialPlatformState(),
            results: { sheet: null, direct: null, analytics: null },
            logs: [],
          },
          actions: {},
        }}
      >
        <SetupScreen />
      </ShowcaseContext.Provider>
    </ThemeProvider>
  );
  const screen = render(element('reviewingConfiguration'));
  expect(screen.getByLabelText('正在确认配置')).toBeTruthy();
  expect(screen.getByRole('button', { name: '确认配置' })).toBeDisabled();
  screen.rerender(element('initialized'));
  expect(screen.getByLabelText('初始化完成')).toBeTruthy();
  screen.rerender(element('unexpected-phase'));
  expect(screen.getByLabelText('未知状态')).toBeTruthy();
});
